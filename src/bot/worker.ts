// src/bot/worker.ts - メインBotクラス
import puppeteer, { Browser, Page } from 'puppeteer';
import { BotConfig, ChatMessage, ModerationResult, ModLog, BanRecord } from '@/types';
import { moderateWithAI } from '@/lib/gemini';
import { checkNgWords } from '@/lib/ng-word-checker';
import { GoogleSheetsLogger } from '@/lib/google-sheets';

import { supabaseAdmin } from '@/lib/supabase';
import { setupChatMonitoring } from './chat-monitor';
import { deleteMessage, kickUser, openChatPanel } from './actions';
import { startParticipantMonitoring, stopParticipantMonitoring } from './participant-monitor';

export class ZoomModBot {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private config: BotConfig;
  private isRunning = false;
  private chatHistory: string[] = [];
  private processedMessages = new Set<string>();
  private bannedUsernames = new Set<string>();
  private sheetsLogger: GoogleSheetsLogger | null = null;
  private participantInterval: NodeJS.Timeout | null = null;
  private processedCount = 0;
  private startedAt: string | null = null;

  constructor(config: BotConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('[Bot] Already running.');
      return;
    }

    try {
      this.startedAt = new Date().toISOString();
      this.isRunning = true;

      console.log('[Bot] Starting Zoom Mod Bot...');

      await this.launchBrowser();
      await this.loginToZoom();
      await this.joinWebinar();

      if (!this.page) throw new Error('Page not initialized');

      await openChatPanel(this.page);

      // BAN済みユーザーをセットに追加（Supabase blacklist から）
      this.config.bannedUsers.forEach(u => this.bannedUsernames.add(u.zoom_username));
      console.log(`[Bot] Loaded ${this.config.bannedUsers.length} banned users from Supabase.`);

      // Google Sheets ロガー初期化 + BAN者リストをマージ
      if (this.config.sheetsSync) {
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        if (spreadsheetId) {
          this.sheetsLogger = new GoogleSheetsLogger(spreadsheetId);
          await this.sheetsLogger.init();
          console.log('[Bot] Google Sheets Logger initialized.');

          // Sheets からも BAN 者リストを取得してマージ（バックアップ）
          try {
            const sheetsBannedUsers = await this.sheetsLogger.getBannedUsers();
            let newFromSheets = 0;
            for (const user of sheetsBannedUsers) {
              if (!this.bannedUsernames.has(user.zoom_username)) {
                this.bannedUsernames.add(user.zoom_username);
                newFromSheets++;

                // Supabase に存在しない BAN 者を同期保存
                await supabaseAdmin.from('blacklist').upsert({
                  zoom_username: user.zoom_username,
                  zoom_email: user.zoom_email,
                  reason: 'Google Sheets から同期',
                  ban_type: 'permanent',
                  is_active: true,
                  sheets_synced: true,
                }, { onConflict: 'zoom_username', ignoreDuplicates: true });
              }
            }
            console.log(`[Bot] Merged ${sheetsBannedUsers.length} users from Sheets (${newFromSheets} new).`);
          } catch (e) {
            console.error('[Bot] Failed to load banned users from Sheets:', e);
          }
        }
      }

      console.log(`[Bot] Total banned users: ${this.bannedUsernames.size}`);

      // チャット監視開始
      const monitoringHandler = async (msg: ChatMessage) => {
        await this.handleMessage(msg);
      };

      try {
        await setupChatMonitoring(this.page, monitoringHandler);
      } catch (err) {
        console.warn('[Bot] Chat monitoring setup failed:', err);
      }

      // 参加者監視開始
      this.participantInterval = startParticipantMonitoring(
        this.page,
        this.bannedUsernames,
        async (username) => {
          console.log(`[Bot] Re-blocked user detected: ${username}`);
          const log: ModLog = {
            webinar_id: this.config.webinarId,
            webinar_name: this.config.webinarName,
            username,
            message: '(再入室検知)',
            action: 're-blocked',
            detection_method: 'blacklist',
            ai_score: 0,
            ai_reason: '再入室ブロック',
            ai_category: '',
            matched_word: null,
          };
          await this.saveLog(log);
        }
      );

      console.log('[Bot] Bot started successfully.');
    } catch (error) {
      console.error('[Bot] Failed to start bot:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;
    console.log('[Bot] Stopping bot...');
    this.isRunning = false;

    if (this.participantInterval) {
      stopParticipantMonitoring(this.participantInterval);
      this.participantInterval = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
    console.log('[Bot] Bot stopped.');
  }

  getStatus(): { isRunning: boolean; processedCount: number; webinarId: string; webinarName: string; startedAt: string | null } {
    return {
      isRunning: this.isRunning,
      processedCount: this.processedCount,
      webinarId: this.config.webinarId,
      webinarName: this.config.webinarName,
      startedAt: this.startedAt,
    };
  }

  private async launchBrowser(): Promise<void> {
    console.log('[Bot] Launching browser...');
    this.browser = await puppeteer.launch({
      headless: process.env.PUPPETEER_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--disable-dev-shm-usage',
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
    );
  }

  private async loginToZoom(): Promise<void> {
    if (!this.page) throw new Error('Page is not available');
    console.log('[Bot] Logging in to Zoom...');
    await this.page.goto('https://zoom.us/signin', { waitUntil: 'networkidle2' });

    await this.page.type('#email', this.config.zoomEmail);
    await this.page.type('#password', this.config.zoomPassword);

    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
      this.page.click('button[type="submit"]'),
    ]);

    console.log('[Bot] Logged in.');
  }

  private async joinWebinar(): Promise<void> {
    if (!this.page) throw new Error('Page is not available');
    console.log('[Bot] Joining webinar...');
    const url = `https://zoom.us/wc/join/${this.config.webinarId}`;
    await this.page.goto(url, { waitUntil: 'networkidle2' });

    try {
      await this.page.waitForSelector('input[name="uname"]', { timeout: 5000 });
      await this.page.type('input[name="uname"]', 'Moderation Bot');

      await Promise.all([
        this.page.waitForNavigation({ waitUntil: 'load' }),
        this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const joinBtn = buttons.find(b => b.textContent?.includes('Join'));
          if (joinBtn) joinBtn.click();
        }),
      ]);

      await new Promise(resolve => setTimeout(resolve, 8000));
      console.log('[Bot] Joined webinar.');
    } catch {
      console.log('[Bot] Join inputs not found or already joined.');
    }
  }

  private async handleMessage(msg: ChatMessage): Promise<void> {
    if (!this.isRunning || !this.page) return;

    // 重複チェック
    if (this.processedMessages.has(msg.msgId)) return;
    this.processedMessages.add(msg.msgId);

    // 文脈の更新
    this.chatHistory.push(`${msg.username}: ${msg.message}`);
    if (this.chatHistory.length > 20) {
      this.chatHistory.shift();
    }

    this.processedCount++;

    // 1. NGワードチェック
    const ngMatch = checkNgWords(msg.message, this.config.ngWords);

    if (ngMatch.matched) {
      await this.takeAction(
        msg.username,
        msg.message,
        { score: 1.0, category: 'hate', reason: `NGワード検出: ${ngMatch.matchedWord}` },
        ngMatch.matchedWord,
        'ngword'
      );
      return;
    }

    // 2. AI判定
    const aiResult = await moderateWithAI(msg.message, msg.username, this.chatHistory);

    if (aiResult.score >= 0.8) {
      // 高スコア: 削除 + 退出 + BAN + 記録 + 通知
      await this.takeAction(msg.username, msg.message, aiResult, null, 'ai');
    } else if (aiResult.score >= this.config.aiThreshold) {
      // 閾値超え: 削除 + 通知（退出はしない）
      if (this.config.autoDelete) {
        await deleteMessage(this.page, msg.message);
      }
      const log: ModLog = {
        webinar_id: this.config.webinarId,
        webinar_name: this.config.webinarName,
        username: msg.username,
        message: msg.message,
        action: 'deleted',
        detection_method: 'ai',
        ai_score: aiResult.score,
        ai_reason: aiResult.reason,
        ai_category: aiResult.category,
        matched_word: null,
      };
      await this.saveLog(log);
    } else {
      // パス（ログのみ）
      await this.saveLog({
        webinar_id: this.config.webinarId,
        webinar_name: this.config.webinarName,
        username: msg.username,
        message: msg.message,
        action: 'passed',
        detection_method: 'ai',
        ai_score: aiResult.score,
        ai_reason: aiResult.reason,
        ai_category: aiResult.category,
        matched_word: null,
      });
    }
  }

  private async takeAction(
    username: string,
    message: string,
    result: ModerationResult,
    matchedWord: string | null,
    detectionMethod: 'ngword' | 'ai'
  ): Promise<void> {
    if (!this.page) return;

    // メッセージ削除
    if (this.config.autoDelete) {
      try {
        await deleteMessage(this.page, message);
      } catch (e) {
        console.error('[Bot] Delete failed:', e);
      }
    }

    // ユーザー退出 + BAN
    if (this.config.autoKick) {
      try {
        await kickUser(this.page, username);
        await this.saveBan(username, message, result, matchedWord);
        this.bannedUsernames.add(username);
      } catch (e) {
        console.error('[Bot] Kick failed:', e);
      }
    }

    // ログ記録
    const log: ModLog = {
      webinar_id: this.config.webinarId,
      webinar_name: this.config.webinarName,
      username,
      message,
      action: this.config.autoKick ? 'kicked' : 'deleted',
      detection_method: detectionMethod,
      ai_score: result.score,
      ai_reason: result.reason,
      ai_category: result.category,
      matched_word: matchedWord,
    };
    await this.saveLog(log);
  }

  private async saveLog(log: ModLog): Promise<void> {
    try {
      await supabaseAdmin.from('mod_logs').insert(log);
    } catch (e) {
      console.error('[Bot] Failed to save log:', e);
    }
  }

  private async saveBan(
    username: string,
    message: string,
    result: ModerationResult,
    matchedWord: string | null
  ): Promise<void> {
    try {
      // blacklist テーブルに保存（sheets_synced は後で更新）
      const { data: insertedBan } = await supabaseAdmin.from('blacklist').insert({
        zoom_username: username,
        reason: result.reason,
        original_message: message,
        ai_score: result.score,
        ban_type: 'permanent',
        webinar_id: this.config.webinarId,
        webinar_name: this.config.webinarName,
        is_active: true,
        sheets_synced: false,
      }).select('id').single();

      console.log(`[Bot] Ban saved to Supabase: ${username}`);

      // Google Sheets に記録
      if (this.sheetsLogger) {
        const record: BanRecord = {
          bannedAt: new Date().toLocaleString('ja-JP'),
          webinarId: this.config.webinarId,
          webinarName: this.config.webinarName,
          username,
          email: null,
          message,
          detectionMethod: matchedWord ? 'ngword' : 'ai',
          aiScore: result.score,
          aiReason: result.reason,
          matchedWord: matchedWord || '-',
          action: '削除+退出+永久BAN',
          banType: 'permanent',
          banExpiry: null,
          moderator: 'Bot(自動)',
          note: '',
        };
        await this.sheetsLogger.appendBanRecord(record);

        // Sheets 書き込み成功 → Supabase の sheets_synced を true に更新
        if (insertedBan?.id) {
          await supabaseAdmin.from('blacklist')
            .update({ sheets_synced: true })
            .eq('id', insertedBan.id);
          console.log(`[Bot] Sheets sync flag updated for: ${username}`);
        }
      }
    } catch (e) {
      console.error('[Bot] Failed to save ban:', e);
    }
  }
}
