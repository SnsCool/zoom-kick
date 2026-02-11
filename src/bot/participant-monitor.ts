import { Page } from 'puppeteer';
import { kickUser } from './actions';

export function startParticipantMonitoring(
  page: Page,
  bannedUsernames: Set<string>,
  onReblocked: (username: string) => void
): NodeJS.Timeout {
  const intervalId = setInterval(async () => {
    try {
      // 参加者リストの名前を取得
      const participants = await page.evaluate(() => {
        const selectors = [
          '[class*="participants-item"]',
          '[class*="attendee-item"]',
          '[class*="participant-list"] [class*="name"]'
        ];
        const elements = document.querySelectorAll(selectors.join(', '));
        
        // 表示テキストを抽出（不要な空白を削除）
        return Array.from(elements).map(el => el.textContent?.trim() || '');
      });

      // Bannedユーザーのチェック
      for (const participantName of participants) {
        if (!participantName) continue;

        // 部分一致を含めてチェック
        const isBanned = Array.from(bannedUsernames).some(banned => 
          participantName.includes(banned)
        );

        if (isBanned) {
          console.log(`[Bot] Banned user detected: ${participantName}. Executing kick...`);
          
          // 退出処理とコールバック
          await kickUser(page, participantName);
          onReblocked(participantName);
        }
      }
    } catch (error) {
      console.error('[Bot] Error during participant monitoring:', error);
    }
  }, 5000);

  return intervalId;
}

export function stopParticipantMonitoring(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId);
  console.log('[Bot] Participant monitoring stopped.');
}