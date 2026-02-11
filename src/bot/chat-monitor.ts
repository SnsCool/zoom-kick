// src/bot/chat-monitor.ts - チャット監視モジュール
import { Page } from 'puppeteer';
import { ChatMessage } from '@/types';

const LOG_PREFIX = '[Bot]';

const CHAT_CONTAINER_SELECTORS = [
  '.chat-container__chat-list',
  '[class*="chat-message-list"]',
  '[data-testid="chat-message-list"]',
  '.virtuoso-grid-list',
  '#chat-list',
];

const MESSAGE_SELECTORS = [
  '[class*="chat-message"]',
  '[data-testid*="chat-message"]',
];

const USERNAME_SELECTORS = [
  '[class*="sender"]',
  '[class*="username"]',
  '[class*="display-name"]',
];

const CONTENT_SELECTORS = [
  '[class*="content"]',
  '[class*="text-content"]',
  '[class*="message-content"]',
];

// セレクタ候補を順に試行し、見つかったものを返す
async function findWorkingSelector(page: Page, selectors: string[]): Promise<string | null> {
  for (const selector of selectors) {
    try {
      const element = await page.$(selector);
      if (element) {
        return selector;
      }
    } catch {
      // 次のセレクタへ
    }
  }
  return null;
}

// MutationObserver によるチャット監視
export async function setupChatMonitoring(
  page: Page,
  onMessage: (msg: ChatMessage) => void
): Promise<void> {
  try {
    const containerSelector = await findWorkingSelector(page, CHAT_CONTAINER_SELECTORS);
    if (!containerSelector) {
      console.log(`${LOG_PREFIX} Chat container not found, falling back to polling.`);
      await setupPollingMonitor(page, onMessage);
      return;
    }

    console.log(`${LOG_PREFIX} Chat container found: ${containerSelector}`);

    // コールバック関数をブラウザ内に公開
    await page.exposeFunction('onNewChatMessage', (msgStr: string) => {
      try {
        const parsed = JSON.parse(msgStr);
        const msg: ChatMessage = {
          username: parsed.username || 'Unknown',
          message: parsed.content || '',
          msgId: parsed.msgId || `${Date.now()}`,
          timestamp: new Date(parsed.timestamp || Date.now()),
        };
        onMessage(msg);
      } catch (e) {
        console.error(`${LOG_PREFIX} Failed to parse message:`, e);
      }
    });

    // MutationObserver を注入
    await page.evaluate((selectors: { container: string; msg: string[]; user: string[]; content: string[] }) => {
      const getText = (parent: Element, sels: string[]): string => {
        for (const s of sels) {
          const el = parent.querySelector(s);
          if (el) return el.textContent?.trim() || '';
        }
        return '';
      };

      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const elem = node as Element;

            const isMessage = selectors.msg.some(s => elem.matches?.(s));
            const messages: Element[] = [];

            if (isMessage) {
              messages.push(elem);
            } else {
              selectors.msg.forEach(s => {
                messages.push(...Array.from(elem.querySelectorAll(s)));
              });
            }

            messages.forEach(msgEl => {
              if (msgEl.hasAttribute('data-processed')) return;
              msgEl.setAttribute('data-processed', 'true');

              const username = getText(msgEl, selectors.user);
              const content = getText(msgEl, selectors.content);

              if (content) {
                const msg = {
                  username: username || 'Unknown',
                  content,
                  msgId: `${content}-${Date.now()}`,
                  timestamp: Date.now(),
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const win = window as unknown as Record<string, (s: string) => void>;
                if (typeof win.onNewChatMessage === 'function') {
                  win.onNewChatMessage(JSON.stringify(msg));
                }
              }
            });
          });
        }
      });

      const target = document.querySelector(selectors.container);
      if (target) {
        observer.observe(target, { childList: true, subtree: true });
        console.log('[Bot] MutationObserver injected.');
      }
    }, {
      container: containerSelector,
      msg: MESSAGE_SELECTORS,
      user: USERNAME_SELECTORS,
      content: CONTENT_SELECTORS,
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} MutationObserver setup failed:`, error);
    await setupPollingMonitor(page, onMessage);
  }
}

// ポーリングによるフォールバック監視
export async function setupPollingMonitor(
  page: Page,
  onMessage: (msg: ChatMessage) => void
): Promise<void> {
  console.log(`${LOG_PREFIX} Setting up polling monitor...`);

  const intervalId = setInterval(async () => {
    try {
      const containerSelector = await findWorkingSelector(page, CHAT_CONTAINER_SELECTORS);
      if (!containerSelector) return;

      const newMessages = await page.evaluate(
        (args: { containerSel: string; msgSels: string[]; userSels: string[]; contentSels: string[] }) => {
          const container = document.querySelector(args.containerSel);
          if (!container) return [];

          const potentialMessages = Array.from(
            container.querySelectorAll(args.msgSels.join(', '))
          );

          const unprocessed = potentialMessages.filter(
            el => !el.hasAttribute('data-processed')
          );

          const results: Array<{ username: string; content: string; msgId: string; timestamp: number }> = [];

          unprocessed.forEach(el => {
            el.setAttribute('data-processed', 'true');

            const getText = (parent: Element, sels: string[]) => {
              for (const s of sels) {
                const found = parent.querySelector(s);
                if (found) return found.textContent?.trim() || '';
              }
              return '';
            };

            const username = getText(el, args.userSels);
            const content = getText(el, args.contentSels);
            const timestamp = Date.now();

            if (content) {
              results.push({
                username: username || 'Unknown',
                content,
                msgId: `${content}-${timestamp}`,
                timestamp,
              });
            }
          });

          return results;
        },
        {
          containerSel: containerSelector,
          msgSels: MESSAGE_SELECTORS,
          userSels: USERNAME_SELECTORS,
          contentSels: CONTENT_SELECTORS,
        }
      );

      newMessages.forEach(raw => {
        const msg: ChatMessage = {
          username: raw.username,
          message: raw.content,
          msgId: raw.msgId,
          timestamp: new Date(raw.timestamp),
        };
        onMessage(msg);
      });
    } catch (error) {
      console.error(`${LOG_PREFIX} Polling error:`, error);
    }
  }, 1000);

  page.on('close', () => clearInterval(intervalId));
}
