import { NextResponse } from 'next/server';
import { isMockMode, mockStore } from '@/lib/mock-data';
import { getBotInstance } from '@/bot/instance';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (isMockMode()) {
    return NextResponse.json(mockStore.getBotStatus());
  }

  const bot = getBotInstance();

  if (bot) {
    const status = bot.getStatus();
    return NextResponse.json(status);
  }

  return NextResponse.json({
    isRunning: false,
    processedCount: 0,
    webinarId: null,
    webinarName: null,
    startedAt: null
  });
}
