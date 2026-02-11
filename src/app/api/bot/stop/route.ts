import { NextResponse } from 'next/server';
import { isMockMode, mockStore } from '@/lib/mock-data';
import { getBotInstance, setBotInstance } from '@/bot/instance';

export async function POST() {
  try {
    if (isMockMode()) {
      const result = mockStore.stopBot();
      if ('error' in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      console.log('[Mock] Bot stopped');
      return NextResponse.json({ status: 'stopped', message: '[Mock] Botを停止しました' }, { status: 200 });
    }

    const bot = getBotInstance();

    if (!bot) {
      return NextResponse.json({ error: 'Bot is not running' }, { status: 400 });
    }

    await bot.stop();
    setBotInstance(null);

    return NextResponse.json({ status: 'stopped', message: 'Botを停止しました' }, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
