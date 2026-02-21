import { getBotInstance, setBotInstance } from '@/bot/instance';

describe('Bot Instance (シングルトン管理)', () => {
  afterEach(() => {
    // テスト間で状態をリセット
    setBotInstance(null);
  });

  it('初期状態では null を返す', () => {
    setBotInstance(null);
    expect(getBotInstance()).toBeNull();
  });

  it('setBotInstance でインスタンスを設定し、getBotInstance で取得できる', () => {
    const mockBot = {
      start: jest.fn(),
      stop: jest.fn(),
      getStatus: jest.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBotInstance(mockBot as any);
    expect(getBotInstance()).toBe(mockBot);
  });

  it('null を設定するとインスタンスがクリアされる', () => {
    const mockBot = { start: jest.fn(), stop: jest.fn(), getStatus: jest.fn() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setBotInstance(mockBot as any);
    expect(getBotInstance()).not.toBeNull();

    setBotInstance(null);
    expect(getBotInstance()).toBeNull();
  });
});
