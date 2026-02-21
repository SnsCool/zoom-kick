import { moderateWithAI } from '@/lib/gemini';

// fetch をモック
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('moderateWithAI', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-api-key' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('API キーがない場合はデフォルト値を返す', async () => {
    delete process.env.GEMINI_API_KEY;
    const result = await moderateWithAI('テスト', 'user1', []);
    expect(result.score).toBe(0.0);
    expect(result.category).toBe('clean');
    expect(result.reason).toBe('AI設定エラー');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('正常なレスポンスを正しくパースする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"score": 0.95, "category": "hate", "reason": "誹謗中傷を含む"}'
            }]
          }
        }]
      })
    });

    const result = await moderateWithAI('死ね', 'troll', []);
    expect(result.score).toBe(0.95);
    expect(result.category).toBe('hate');
    expect(result.reason).toBe('誹謗中傷を含む');
  });

  it('JSONがマークダウンブロックに囲まれていてもパースできる', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '```json\n{"score": 0.1, "category": "clean", "reason": "問題なし"}\n```'
            }]
          }
        }]
      })
    });

    const result = await moderateWithAI('こんにちは', 'user1', []);
    expect(result.score).toBe(0.1);
    expect(result.category).toBe('clean');
  });

  it('429 レート制限でリトライする', async () => {
    // 1回目: 429, 2回目: 成功
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 429, statusText: 'Too Many Requests' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: '{"score": 0.5, "category": "troll", "reason": "荒らしの疑い"}'
              }]
            }
          }]
        })
      });

    const result = await moderateWithAI('荒らし', 'user2', []);
    expect(result.score).toBe(0.5);
    expect(result.category).toBe('troll');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 10000);

  it('429 が最大リトライ回数を超えたらデフォルト値を返す', async () => {
    mockFetch
      .mockResolvedValue({ ok: false, status: 429, statusText: 'Too Many Requests' });

    const result = await moderateWithAI('テスト', 'user3', []);
    expect(result.score).toBe(0.0);
    expect(result.category).toBe('clean');
    expect(result.reason).toBe('APIリクエスト上限超過');
    // 初回 + 2リトライ = 3回
    expect(mockFetch).toHaveBeenCalledTimes(3);
  }, 10000);

  it('API エラー (500等) の場合はデフォルト値を返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error'
    });

    const result = await moderateWithAI('テスト', 'user4', []);
    expect(result.score).toBe(0.0);
    expect(result.reason).toBe('AI判定エラー');
  });

  it('レスポンスにJSONが含まれない場合はデフォルト値を返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: 'この文章は問題ありません' }]
          }
        }]
      })
    });

    const result = await moderateWithAI('テスト', 'user5', []);
    expect(result.score).toBe(0.0);
    expect(result.reason).toBe('AI判定エラー');
  });

  it('不完全なJSONレスポンスはデフォルト値を返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{ text: '{"score": 0.5}' }]  // category, reason 欠損
          }
        }]
      })
    });

    const result = await moderateWithAI('テスト', 'user6', []);
    expect(result.score).toBe(0.0);
    expect(result.reason).toBe('AI判定エラー');
  });

  it('fetch がエラーを投げた場合はデフォルト値を返す', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await moderateWithAI('テスト', 'user7', []);
    expect(result.score).toBe(0.0);
    expect(result.reason).toBe('AI判定エラー');
  });

  it('Gemini API の error フィールドがある場合はデフォルト値を返す', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        error: { code: 400, message: 'Bad request' }
      })
    });

    const result = await moderateWithAI('テスト', 'user8', []);
    expect(result.score).toBe(0.0);
    expect(result.reason).toBe('AI判定エラー');
  });

  it('context を含むプロンプトが送信される', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              text: '{"score": 0.3, "category": "clean", "reason": "通常の発言"}'
            }]
          }
        }]
      })
    });

    const context = ['前のメッセージ1', '前のメッセージ2'];
    await moderateWithAI('テスト', 'user9', context);

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    const promptText = callBody.contents[0].parts[0].text;
    expect(promptText).toContain('前のメッセージ1');
    expect(promptText).toContain('前のメッセージ2');
  });
});
