import { NextResponse } from 'next/server';
import { isMockMode, mockStore } from '@/lib/mock-data';

export async function POST(request: Request) {
  const body = await request.json();
  const { password } = body;

  if (isMockMode()) {
    if (mockStore.checkPassword(password)) {
      return NextResponse.json({ success: true }, { status: 200 });
    }
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  if (password === process.env.BOT_ADMIN_PASSWORD) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
}