// src/lib/google-sheets.ts - Google Sheets BAN記録連携
import { google, sheets_v4 } from 'googleapis';
import { BanRecord, BannedUser } from '@/types';

const SHEET_NAME = 'BAN履歴';
const HEADERS = [
  'BAN日時',
  'ウェビナーID',
  'ウェビナー名',
  'ユーザー名',
  'メールアドレス',
  '問題のメッセージ',
  '検出方法',
  'AI判定スコア',
  'AI判定理由',
  'マッチしたNGワード',
  '対応内容',
  'BAN種別',
  'BAN解除日',
  '対応者',
  '備考',
];

export class GoogleSheetsLogger {
  private spreadsheetId: string;
  private sheets: sheets_v4.Sheets | null = null;
  private initialized = false;

  constructor(spreadsheetId: string) {
    this.spreadsheetId = spreadsheetId;
  }

  async init(): Promise<void> {
    try {
      const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      if (!credentialsJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is missing');
      }

      const credentials = JSON.parse(credentialsJson);
      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });

      this.sheets = google.sheets({ version: 'v4', auth });
      this.initialized = true;
      console.log('[Sheets] Initialized successfully');

      // 「BAN履歴」シートが存在しなければ自動作成
      await this.ensureSheetExists();
    } catch (error) {
      console.error('[Sheets] Init error:', error);
      throw error;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.sheets) {
      throw new Error('[Sheets] GoogleSheetsLogger is not initialized. Call init() first.');
    }
  }

  // 「BAN履歴」シートの存在確認＆自動作成
  async ensureSheetExists(): Promise<void> {
    this.ensureInitialized();

    try {
      // スプレッドシートの情報を取得
      const spreadsheet = await this.sheets!.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
      });

      const existingSheets = spreadsheet.data.sheets || [];
      const sheetExists = existingSheets.some(
        s => s.properties?.title === SHEET_NAME
      );

      if (!sheetExists) {
        // 「BAN履歴」シートを新規作成
        console.log(`[Sheets] "${SHEET_NAME}" sheet not found. Creating...`);
        await this.sheets!.spreadsheets.batchUpdate({
          spreadsheetId: this.spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: SHEET_NAME,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 15,
                      frozenRowCount: 1, // ヘッダー行を固定
                    },
                  },
                },
              },
            ],
          },
        });
        console.log(`[Sheets] "${SHEET_NAME}" sheet created.`);

        // ヘッダー行を書き込み
        await this.sheets!.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${SHEET_NAME}!A1:O1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [HEADERS],
          },
        });
        console.log('[Sheets] Header row written.');

        // ヘッダー行のスタイリング（太字 + 背景色）
        const newSheet = await this.sheets!.spreadsheets.get({
          spreadsheetId: this.spreadsheetId,
        });
        const sheetId = newSheet.data.sheets?.find(
          s => s.properties?.title === SHEET_NAME
        )?.properties?.sheetId;

        if (sheetId !== undefined) {
          await this.sheets!.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            requestBody: {
              requests: [
                // ヘッダー行を太字に
                {
                  repeatCell: {
                    range: {
                      sheetId,
                      startRowIndex: 0,
                      endRowIndex: 1,
                      startColumnIndex: 0,
                      endColumnIndex: 15,
                    },
                    cell: {
                      userEnteredFormat: {
                        backgroundColor: { red: 0.2, green: 0.2, blue: 0.3, alpha: 1 },
                        textFormat: {
                          bold: true,
                          foregroundColor: { red: 1, green: 1, blue: 1 },
                        },
                      },
                    },
                    fields: 'userEnteredFormat(backgroundColor,textFormat)',
                  },
                },
                // 列幅の自動調整
                {
                  autoResizeDimensions: {
                    dimensions: {
                      sheetId,
                      dimension: 'COLUMNS',
                      startIndex: 0,
                      endIndex: 15,
                    },
                  },
                },
              ],
            },
          });
          console.log('[Sheets] Header styling applied.');
        }
      } else {
        // シートは存在するが、ヘッダー行があるか確認
        const headerCheck = await this.sheets!.spreadsheets.values.get({
          spreadsheetId: this.spreadsheetId,
          range: `${SHEET_NAME}!A1:O1`,
        });

        if (!headerCheck.data.values || headerCheck.data.values.length === 0) {
          // ヘッダー行が空なら書き込み
          await this.sheets!.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${SHEET_NAME}!A1:O1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [HEADERS],
            },
          });
          console.log('[Sheets] Header row added to existing sheet.');
        } else {
          console.log(`[Sheets] "${SHEET_NAME}" sheet already exists with headers.`);
        }
      }
    } catch (error) {
      console.error('[Sheets] Failed to ensure sheet exists:', error);
    }
  }

  async appendBanRecord(record: BanRecord): Promise<void> {
    try {
      this.ensureInitialized();

      const detectionLabel = record.detectionMethod === 'ngword' ? 'NGワード' : 'AI判定';
      const banTypeLabel = record.banType === 'permanent' ? '永久BAN' : '一時BAN';

      const values = [
        [
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
        ],
      ];

      await this.sheets!.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEET_NAME}!A:O`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values },
      });

      console.log('[Sheets] Ban record appended');
    } catch (error) {
      console.error('[Sheets] Failed to append ban record:', error);
    }
  }

  async getBannedUsers(): Promise<BannedUser[]> {
    try {
      this.ensureInitialized();

      const response = await this.sheets!.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${SHEET_NAME}!D:E`,
      });

      const rows = response.data.values;
      if (!rows || rows.length <= 1) {
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
