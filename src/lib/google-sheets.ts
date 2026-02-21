// src/lib/google-sheets.ts - Google Sheets BAN記録連携 (gog CLI 経由)
import { execFile } from 'child_process';
import { promisify } from 'util';
import { BanRecord, BannedUser } from '@/types';

const execFileAsync = promisify(execFile);

const SHEET_NAME = 'BAN履歴';
const GOG_BIN = 'gog';

// gog CLI のコマンドを実行するヘルパー
async function gogSheets(args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(GOG_BIN, ['sheets', ...args, '--json', '--no-input']);
    return stdout;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Sheets] gog command failed: gog sheets ${args.join(' ')}`, msg);
    throw error;
  }
}

// パイプ区切りの値文字列を組み立てる（セル内の | はエスケープ不要、gog が処理）
function toPipeRow(cells: string[]): string {
  return cells.join('|');
}

export class GoogleSheetsLogger {
  private spreadsheetId: string;
  private initialized = false;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
  }

  async init(): Promise<void> {
    try {
      if (!this.spreadsheetId) {
        throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is missing');
      }

      // gog CLI が使えるか確認（metadata取得でテスト）
      await gogSheets(['metadata', this.spreadsheetId]);
      this.initialized = true;
      console.log('[Sheets] Initialized successfully (via gog CLI)');

      // 「BAN履歴」シートのヘッダー確認
      await this.ensureHeaderExists();
    } catch (error) {
      console.error('[Sheets] Init error:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[Sheets] GoogleSheetsLogger is not initialized. Call init() first.');
    }
  }

  // ヘッダー行が存在するか確認し、なければ書き込む
  private async ensureHeaderExists(): Promise<void> {
    try {
      const raw = await gogSheets(['get', this.spreadsheetId, `${SHEET_NAME}!A1:O1`]);
      const data = JSON.parse(raw);

      if (data.values && data.values.length > 0 && data.values[0].length > 0) {
        console.log(`[Sheets] "${SHEET_NAME}" sheet already has headers.`);
        return;
      }
    } catch {
      // シートが存在しない or 空 → ヘッダーを書き込む
    }

    const headers = [
      'BAN日時', 'ウェビナーID', 'ウェビナー名', 'ユーザー名', 'メールアドレス',
      '問題のメッセージ', '検出方法', 'AI判定スコア', 'AI判定理由', 'マッチしたNGワード',
      '対応内容', 'BAN種別', 'BAN解除日', '対応者', '備考',
    ];

    await gogSheets([
      'update', this.spreadsheetId, `${SHEET_NAME}!A1:O1`,
      toPipeRow(headers), '--input', 'RAW',
    ]);
    console.log('[Sheets] Header row written.');
  }

  async appendBanRecord(record: BanRecord): Promise<void> {
    try {
      this.ensureInitialized();

      const detectionLabel = record.detectionMethod === 'ngword' ? 'NGワード' : 'AI判定';
      const banTypeLabel = record.banType === 'permanent' ? '永久BAN' : '一時BAN';

      const row = toPipeRow([
        record.bannedAt,
        record.webinarId,
        record.webinarName,
        record.username,
        record.email || '不明',
        record.message,
        detectionLabel,
        record.aiScore.toFixed(2),
        record.aiReason,
        record.matchedWord || '-',
        record.action,
        banTypeLabel,
        record.banExpiry || '-',
        record.moderator,
        record.note,
      ]);

      await gogSheets([
        'append', this.spreadsheetId, `${SHEET_NAME}!A:O`, row,
      ]);

      console.log('[Sheets] Ban record appended');
    } catch (error) {
      console.error('[Sheets] Failed to append ban record:', error);
    }
  }

  async getBannedUsers(): Promise<BannedUser[]> {
    try {
      this.ensureInitialized();

      const raw = await gogSheets(['get', this.spreadsheetId, `${SHEET_NAME}!D:E`]);
      const data = JSON.parse(raw);

      const rows: string[][] = data.values || [];
      if (rows.length <= 1) {
        return [];
      }

      // ヘッダー行を除外
      const dataRows = rows.slice(1);

      // 重複排除
      const uniqueUsers = new Map<string, BannedUser>();

      dataRows.forEach((row: string[]) => {
        const username = row[0];
        const email = row[1];

        if (username && !uniqueUsers.has(username)) {
          uniqueUsers.set(username, {
            zoom_username: username,
            zoom_email: email && email !== '不明' ? email : null,
          });
        }
      });

      return Array.from(uniqueUsers.values());
    } catch (error) {
      console.error('[Sheets] Failed to get banned users:', error);
      return [];
    }
  }
}
