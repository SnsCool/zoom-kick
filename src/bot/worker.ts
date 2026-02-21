// src/bot/worker.ts - メインBotクラス（Zoom API + WebSocket ベース）

import { BotConfig, ChatMessage, ModerationResult, ModLog, BanRecord } from '@/types';
import { moderateWithAI } from '@/lib/gemini';
import { checkNgWords } from '@/lib/ng-word-checker';
import { GoogleSheetsLogger } from '@/lib/google-sheets';
import { supabaseAdmin } from '@/lib/supabase';
import { deleteChatMessage, removeParticipant, getParticipants } from '@/lib/zoom-api';
import { ZoomWebSocketClient, ZoomChatEvent, ZoomParticipantEvent } from '@/lib/zoom-websocket';

export class ZoomModBot {
  private config: BotConfig;
  private wsClient: ZoomWebSocketClient | null = null;
  private isRunning = false;
  private chatHistory: string[] = [];
  private processedMessages = new Set<string>();
  private bannedUsernames = new Set<string>();
  private sheetsLogger: GoogleSheetsLogger | null = null;
  private participantCheckInterval: NodeJS.Timeout | null = null;
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
      console.log('[Bot] Starting Zoom Mod Bot (API mode)...');

      // BAN済みユーザーをロード
      this.config.bannedUsers.forEach(u => this.bannedUsernames.add(u.zoom_username));
      console.log(`[Bot] Loaded ${this.config.bannedUsers.length} banned users from Supabase.`);

      // Google Sheets ロガー初期化（失敗してもBot自体は継続）
      if (this.config.sheetsSync) {
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        if (spreadsheetId) {
          try {
            this.sheetsLogger = new GoogleSheetsLogger(spreadsheetId);
            await this.sheetsLogger.init();
            console.log('[Bot] Google Sheets Logger initialized.');

            const sheetsBannedUsers = await this.sheetsLogger.getBannedUsers();
            let newFromSheets = 0;
            for (const user of sheetsBannedUsers) {
              if (!this.bannedUsernames.has(user.zoom_username)) {
                this.bannedUsernames.add(user.zoom_username);
                newFromSheets++;
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
            console.error('[Bot] Google Sheets 初期化に失敗しましたが、Bot は継続します:', e);
            this.sheetsLogger = null;
          }
        }
      }

      console.log(`[Bot] Total banned users: ${this.bannedUsernames.size}`);

      // WebSocket 接続
      const wsUrl = process.env.ZOOM_WEBSOCKET_URL;
      if (!wsUrl) {
        throw new Error('ZOOM_WEBSOCKET_URL が未設定');
      }

      this.wsClient = new ZoomWebSocketClient(wsUrl);

      // チャットメッセージハンドラ
      this.wsClient.onChat((event: ZoomChatEvent) => {
        this.handleChatEvent(event).catch(err => {
          console.error('[Bot] Chat event handling error:', err);
        });
      });

      // 参加者参加ハンドラ（再入室ブロック）
      if (this.config.blockReentry) {
        this.wsClient.onParticipant((event: ZoomParticipantEvent) => {
          this.handleParticipantJoined(event).catch(err => {
            console.error('[Bot] Participant event handling error:', err);
          });
        });
      }

      await this.wsClient.connect();

      // 定期的な参加者チェック（WebSocket イベントのバックアップ）
      if (this.config.blockReentry) {
        this.participantCheckInterval = setInterval(async () => {
          await this.checkBannedParticipants();
        }, 30000); // 30秒ごと
      }

      console.log('[Bot] Bot started successfully (API mode).');
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

    if (this.participantCheckInterval) {
      clearInterval(this.participantCheckInterval);
      this.participantCheckInterval = null;
    }

    if (this.wsClient) {
      this.wsClient.disconnect();
      this.wsClient = null;
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

  /**
   * WebSocket から受信したチャットイベントを処理
   */
  private async handleChatEvent(event: ZoomChatEvent): Promise<void> {
    if (!this.isRunning) return;

    const obj = event.payload?.object;
    if (!obj) return;

    // メッセージ情報を抽出（複数フォーマットに対応）
    const messageId = obj.message?.id || '';
    const messageText = obj.message?.message || obj.message_content || '';
    const username = obj.participant?.user_name || obj.message?.sender || '';
    const participantId = obj.participant?.id || obj.participant?.user_id || '';

    if (!messageText || !username) {
      console.log('[Bot] 不完全なチャットイベント、スキップ');
      return;
    }

    const msg: ChatMessage = {
      username,
      message: messageText,
      msgId: messageId || `${username}-${Date.now()}`,
      timestamp: new Date(),
    };

    await this.handleMessage(msg, participantId, messageId);
  }

  /**
   * 参加者参加イベントを処理（再入室ブロック）
   */
  private async handleParticipantJoined(event: ZoomParticipantEvent): Promise<void> {
    if (!this.isRunning) return;

    const participant = event.payload?.object?.participant;
    if (!participant) return;

    const username = participant.user_name;
    const participantId = participant.id || participant.user_id;
    const meetingId = event.payload.object.id;

    if (this.bannedUsernames.has(username)) {
      console.log(`[Bot] BAN済みユーザー再入室検知: ${username}`);

      await removeParticipant(meetingId, participantId);

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
  }

  /**
   * 定期的にBAN済みユーザーが参加者リストにいないかチェック
   */
  private async checkBannedParticipants(): Promise<void> {
    if (!this.isRunning || this.bannedUsernames.size === 0) return;

    try {
      const participants = await getParticipants(this.config.webinarId);

      for (const p of participants) {
        if (this.bannedUsernames.has(p.user_name)) {
          console.log(`[Bot] BAN済みユーザー発見（定期チェック）: ${p.user_name}`);
          await removeParticipant(this.config.webinarId, p.id);

          const log: ModLog = {
            webinar_id: this.config.webinarId,
            webinar_name: this.config.webinarName,
            username: p.user_name,
            message: '(定期チェックで検知)',
            action: 're-blocked',
            detection_method: 'blacklist',
            ai_score: 0,
            ai_reason: '再入室ブロック（定期チェック）',
            ai_category: '',
            matched_word: null,
          };
          await this.saveLog(log);
        }
      }
    } catch (error) {
      console.error('[Bot] 参加者チェックエラー:', error);
    }
  }

  /**
   * メッセージをモデレーションパイプラインで処理
   */
  private async handleMessage(msg: ChatMessage, participantId: string, messageId: string): Promise<void> {
    if (!this.isRunning) return;

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
        'ngword',
        participantId,
        messageId
      );
      return;
    }

    // 2. AI判定
    const aiResult = await moderateWithAI(msg.message, msg.username, this.chatHistory);

    if (aiResult.score >= 0.8) {
      // 高スコア: 削除 + 退出 + BAN
      await this.takeAction(msg.username, msg.message, aiResult, null, 'ai', participantId, messageId);
    } else if (aiResult.score >= this.config.aiThreshold) {
      // 閾値超え: 削除のみ
      if (this.config.autoDelete && messageId) {
        await deleteChatMessage(this.config.webinarId, messageId);
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
      // パス
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
    detectionMethod: 'ngword' | 'ai',
    participantId: string,
    messageId: string
  ): Promise<void> {
    // メッセージ削除
    if (this.config.autoDelete && messageId) {
      try {
        await deleteChatMessage(this.config.webinarId, messageId);
      } catch (e) {
        console.error('[Bot] Delete failed:', e);
      }
    }

    // ユーザー退出 + BAN
    if (this.config.autoKick && participantId) {
      try {
        await removeParticipant(this.config.webinarId, participantId);
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

        if (insertedBan?.id) {
          await supabaseAdmin.from('blacklist')
            .update({ sheets_synced: true })
            .eq('id', insertedBan.id);
        }
      }
    } catch (e) {
      console.error('[Bot] Failed to save ban:', e);
    }
  }
}
