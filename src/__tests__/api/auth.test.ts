/**
 * API Route テスト
 * モックモードでの動作を中心にテスト
 */

// モック設定: API Route がインポートする前にモックを登録
jest.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
    })),
  },
}));

jest.mock('@/bot/instance', () => ({
  getBotInstance: jest.fn(() => null),
  setBotInstance: jest.fn(),
}));

// MOCK_MODE を常に true に
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    MOCK_MODE: 'true',
    BOT_ADMIN_PASSWORD: 'test-password',
  };
});
afterAll(() => {
  process.env = originalEnv;
});

describe('POST /api/auth', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST } = require('@/app/api/auth/route');

  it('正しいパスワードで認証成功 (200)', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password: 'test-password' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });

  it('間違ったパスワードで認証失敗 (401)', async () => {
    const request = new Request('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify({ password: 'wrong-password' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Invalid password');
  });
});

describe('GET /api/ng-words', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/app/api/ng-words/route');

  it('モックモードでNGワード一覧を取得 (200)', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ngWords).toBeDefined();
    expect(Array.isArray(data.ngWords)).toBe(true);
  });
});

describe('POST /api/ng-words', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST } = require('@/app/api/ng-words/route');

  it('NGワードを追加できる (201)', async () => {
    const request = new Request('http://localhost/api/ng-words', {
      method: 'POST',
      body: JSON.stringify({ word: '新しいNGワード', category: 'テスト', severity: 'low' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.ngWord.word).toBe('新しいNGワード');
  });

  it('空のwordはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/ng-words', {
      method: 'POST',
      body: JSON.stringify({ word: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('DELETE /api/ng-words', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { DELETE } = require('@/app/api/ng-words/route');

  it('IDなしはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/ng-words', {
      method: 'DELETE',
      body: JSON.stringify({}),
    });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/blacklist', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/app/api/blacklist/route');

  it('モックモードでブラックリスト取得 (200)', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.blacklist).toBeDefined();
    expect(Array.isArray(data.blacklist)).toBe(true);
  });
});

describe('POST /api/blacklist', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { POST } = require('@/app/api/blacklist/route');

  it('ブラックリストにエントリ追加 (201)', async () => {
    const request = new Request('http://localhost/api/blacklist', {
      method: 'POST',
      body: JSON.stringify({
        zoom_username: 'test_ban_user',
        reason: 'テストBAN',
        ban_type: 'permanent',
      }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.entry.zoom_username).toBe('test_ban_user');
  });

  it('zoom_username なしはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/blacklist', {
      method: 'POST',
      body: JSON.stringify({ reason: 'テスト' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('reason なしはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/blacklist', {
      method: 'POST',
      body: JSON.stringify({ zoom_username: 'user' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('PUT /api/blacklist', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PUT } = require('@/app/api/blacklist/route');

  it('id と ban_type なしはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/blacklist', {
      method: 'PUT',
      body: JSON.stringify({}),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/settings', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/app/api/settings/route');

  it('モックモードで設定取得 (200)', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.settings).toBeDefined();
    expect(data.settings.ai_threshold).toBeDefined();
  });
});

describe('PUT /api/settings', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PUT } = require('@/app/api/settings/route');

  it('設定を更新できる (200)', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ key: 'ai_threshold', value: { value: 0.9 } }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(200);
  });

  it('keyなしはバリデーションエラー (400)', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ value: { value: 0.5 } }),
    });
    const response = await PUT(request);
    expect(response.status).toBe(400);
  });
});

describe('GET /api/logs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/app/api/logs/route');

  it('モックモードでログ取得 (200)', async () => {
    const request = new Request('http://localhost/api/logs');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.logs).toBeDefined();
    expect(data.total).toBeDefined();
    expect(typeof data.banned).toBe('number');
    expect(typeof data.deleted).toBe('number');
    expect(typeof data.passed).toBe('number');
  });

  it('action パラメータでフィルタできる', async () => {
    const request = new Request('http://localhost/api/logs?action=kicked');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    data.logs.forEach((log: { action: string }) => {
      expect(log.action).toBe('kicked');
    });
  });

  it('limit と offset でページネーションできる', async () => {
    const request = new Request('http://localhost/api/logs?limit=2&offset=0');
    const response = await GET(request);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.logs.length).toBeLessThanOrEqual(2);
  });
});

describe('GET /api/bot/status', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GET } = require('@/app/api/bot/status/route');

  it('モックモードでBotステータス取得', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(typeof data.isRunning).toBe('boolean');
    expect(typeof data.processedCount).toBe('number');
  });
});
