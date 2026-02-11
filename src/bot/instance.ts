// src/bot/instance.ts
import type { ZoomModBot } from './worker';

// Next.js dev mode でのホットリロード対策
const globalStore = globalThis as unknown as { __botInstance: ZoomModBot | null };
if (!globalStore.__botInstance) {
  globalStore.__botInstance = null;
}

export function getBotInstance(): ZoomModBot | null {
  return globalStore.__botInstance;
}

export function setBotInstance(bot: ZoomModBot | null): void {
  globalStore.__botInstance = bot;
}