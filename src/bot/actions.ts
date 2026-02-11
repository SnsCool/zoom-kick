// src/bot/actions.ts - メッセージ削除・ユーザー退出アクション
import { Page } from 'puppeteer';

// ヘルパー関数
async function waitMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findAndClick(page: Page, selectors: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const element = await page.waitForSelector(selector, { timeout: 2000 });
      if (element) {
        await element.click();
        return true;
      }
    } catch {
      // 次のセレクタへ
    }
  }
  return false;
}

// チャットパネルを開く
export async function openChatPanel(page: Page): Promise<boolean> {
  const chatSelectors = [
    'button[aria-label*="chat" i]',
    'button[aria-label*="チャット"]',
    '[data-testid="chat-button"]',
  ];

  console.log('[Bot] Attempting to open chat panel...');

  const clicked = await findAndClick(page, chatSelectors);

  if (!clicked) {
    console.log('[Bot] Chat button not found, trying Alt+H...');
    try {
      await page.keyboard.down('Alt');
      await page.keyboard.press('h');
      await page.keyboard.up('Alt');
      await waitMs(500);
      return true;
    } catch {
      console.error('[Bot] Failed to open chat via keyboard shortcut.');
      return false;
    }
  }

  await waitMs(500);
  return true;
}

// メッセージ削除
export async function deleteMessage(page: Page, messageText: string): Promise<boolean> {
  try {
    console.log(`[Bot] Attempting to delete message: "${messageText.substring(0, 30)}..."`);

    // メッセージテキストを含む要素を探す
    const messageElements = await page.$$('[class*="chat-message"], [data-testid*="chat-message"]');

    let targetElement = null;
    for (const el of messageElements) {
      const text = await el.evaluate((node: Element) => node.textContent || '');
      if (text.includes(messageText)) {
        targetElement = el;
        break;
      }
    }

    if (!targetElement) {
      console.log('[Bot] Message not found in DOM.');
      return false;
    }

    // ホバー
    await targetElement.hover();
    await waitMs(300);

    // 「...」(もっと見る) ボタンを探す
    const moreButtonSelectors = [
      'button[aria-label*="more" i]',
      '[class*="more-button"]',
    ];

    let moreButtonFound = false;
    for (const selector of moreButtonSelectors) {
      try {
        const button = await page.waitForSelector(selector, { timeout: 1000, visible: true });
        if (button) {
          await button.click();
          moreButtonFound = true;
          break;
        }
      } catch {
        // 次のセレクタへ
      }
    }

    if (!moreButtonFound) {
      console.log('[Bot] "More" button not found.');
      return false;
    }

    await waitMs(300);

    // ドロップダウンメニューから「削除」を探す
    const menuItems = await page.$$('[role="menuitem"], button');
    let deleteClicked = false;

    for (const item of menuItems) {
      const text = await item.evaluate((el: Element) => el.textContent?.toLowerCase() || '');
      if (text.includes('delete') || text.includes('削除')) {
        await item.click();
        deleteClicked = true;
        break;
      }
    }

    if (!deleteClicked) {
      console.log('[Bot] "Delete" menu item not found.');
      return false;
    }

    await waitMs(300);

    // 確認ダイアログ
    const allButtons = await page.$$('button');
    for (const btn of allButtons) {
      const text = await btn.evaluate((el: Element) => el.textContent?.trim() || '');
      if (text === 'OK' || text === 'はい' || text === 'Yes') {
        await btn.click();
        break;
      }
    }

    console.log('[Bot] Message deletion completed.');
    return true;
  } catch (error) {
    console.error('[Bot] Error during deleteMessage:', error);
    return false;
  }
}

// ユーザー退出
export async function kickUser(page: Page, username: string): Promise<boolean> {
  try {
    console.log(`[Bot] Attempting to kick user: "${username}"`);

    // 参加者パネルを開く
    const participantSelectors = [
      'button[aria-label*="participant" i]',
      'button[aria-label*="参加者"]',
    ];

    const panelOpened = await findAndClick(page, participantSelectors);
    if (!panelOpened) {
      console.log('[Bot] Could not open participants panel.');
      return false;
    }

    await waitMs(1000);

    // 参加者リストからユーザーを探す
    const participantItems = await page.$$('[class*="participants-item"], [class*="attendee-item"]');
    let targetElement = null;

    for (const item of participantItems) {
      const text = await item.evaluate((el: Element) => el.textContent || '');
      if (text.includes(username)) {
        targetElement = item;
        break;
      }
    }

    if (!targetElement) {
      console.log('[Bot] Target user not found in participant list.');
      return false;
    }

    // ホバー
    await targetElement.hover();
    await waitMs(500);

    // 「...」ボタン
    const moreButtons = await targetElement.$$('button');
    let moreFound = false;
    for (const btn of moreButtons) {
      const ariaLabel = await btn.evaluate((el: Element) => el.getAttribute('aria-label') || '');
      const className = await btn.evaluate((el: Element) => el.className || '');
      if (ariaLabel.toLowerCase().includes('more') || className.includes('more')) {
        await btn.click();
        moreFound = true;
        break;
      }
    }

    if (!moreFound) {
      console.log('[Bot] Kick "More" button not found.');
      return false;
    }

    await waitMs(300);

    // 「削除」「退出させる」「Remove」ボタン
    const kickActions = ['Remove', '削除', '退出させる'];
    const kickButtons = await page.$$('button, [role="menuitem"]');
    let kicked = false;

    for (const action of kickActions) {
      for (const btn of kickButtons) {
        const text = await btn.evaluate((el: Element) => el.textContent?.trim() || '');
        if (text === action) {
          await btn.click();
          kicked = true;
          break;
        }
      }
      if (kicked) break;
    }

    if (!kicked) {
      console.log('[Bot] Kick action button not found.');
      return false;
    }

    await waitMs(300);

    // 確認ダイアログ
    const confirmButtons = await page.$$('button');
    for (const btn of confirmButtons) {
      const text = await btn.evaluate((el: Element) => el.textContent?.trim() || '');
      if (text === 'OK' || text === 'はい' || text === 'Remove') {
        await btn.click();
        break;
      }
    }

    console.log(`[Bot] User "${username}" kick action initiated.`);
    return true;
  } catch (error) {
    console.error('[Bot] Error during kickUser:', error);
    return false;
  }
}
