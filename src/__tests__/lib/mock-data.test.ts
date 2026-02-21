import { isMockMode, mockStore } from '@/lib/mock-data';

describe('isMockMode', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('MOCK_MODE=true のとき true を返す', () => {
    process.env.MOCK_MODE = 'true';
    expect(isMockMode()).toBe(true);
  });

  it('MOCK_MODE=false のとき false を返す', () => {
    process.env.MOCK_MODE = 'false';
    expect(isMockMode()).toBe(false);
  });

  it('MOCK_MODE 未設定のとき false を返す', () => {
    delete process.env.MOCK_MODE;
    expect(isMockMode()).toBe(false);
  });
});

describe('mockStore', () => {
  describe('getLogs', () => {
    it('デフォルトでログ一覧を返す', () => {
      const result = mockStore.getLogs();
      expect(result.data).toBeDefined();
      expect(result.total).toBeGreaterThan(0);
      expect(typeof result.banned).toBe('number');
      expect(typeof result.deleted).toBe('number');
      expect(typeof result.passed).toBe('number');
    });

    it('limit で件数を制限できる', () => {
      const result = mockStore.getLogs(3);
      expect(result.data.length).toBeLessThanOrEqual(3);
    });

    it('action でフィルタできる', () => {
      const result = mockStore.getLogs(50, 0, 'kicked');
      result.data.forEach(log => {
        expect(log.action).toBe('kicked');
      });
    });

    it('日付降順でソートされている', () => {
      const result = mockStore.getLogs();
      for (let i = 1; i < result.data.length; i++) {
        const prev = new Date(result.data[i - 1].created_at).getTime();
        const curr = new Date(result.data[i].created_at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });
  });

  describe('addLog', () => {
    it('新しいログを追加し、IDが自動付与される', () => {
      const initialCount = mockStore.getLogs().total;
      const newLog = mockStore.addLog({
        username: 'test_user',
        message: 'テストメッセージ',
        action: 'passed',
      });
      expect(newLog.id).toBeDefined();
      expect(newLog.username).toBe('test_user');
      expect(mockStore.getLogs().total).toBe(initialCount + 1);
    });
  });

  describe('NGワード CRUD', () => {
    it('getNgWords でNGワード一覧を取得できる', () => {
      const words = mockStore.getNgWords();
      expect(Array.isArray(words)).toBe(true);
      expect(words.length).toBeGreaterThan(0);
    });

    it('addNgWord で新しいNGワードを追加できる', () => {
      const initialCount = mockStore.getNgWords().length;
      const newWord = mockStore.addNgWord({
        word: 'テスト禁止語',
        category: 'テスト',
        severity: 'low',
        is_regex: false,
      });
      expect(newWord.id).toBeDefined();
      expect(newWord.word).toBe('テスト禁止語');
      expect(mockStore.getNgWords().length).toBe(initialCount + 1);
    });

    it('deleteNgWord で既存のNGワードを削除できる', () => {
      const words = mockStore.getNgWords();
      const lastWord = words[words.length - 1];
      const result = mockStore.deleteNgWord(lastWord.id);
      expect(result).toBe(true);
    });

    it('存在しないIDの削除は false を返す', () => {
      const result = mockStore.deleteNgWord('nonexistent-id');
      expect(result).toBe(false);
    });
  });

  describe('ブラックリスト CRUD', () => {
    it('getBlacklist で一覧を取得できる', () => {
      const list = mockStore.getBlacklist();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    });

    it('getBlacklist は日付降順でソートされている', () => {
      const list = mockStore.getBlacklist();
      for (let i = 1; i < list.length; i++) {
        const prev = new Date(list[i - 1].banned_at).getTime();
        const curr = new Date(list[i].banned_at).getTime();
        expect(prev).toBeGreaterThanOrEqual(curr);
      }
    });

    it('addBlacklist で新しいエントリを追加できる', () => {
      const initialCount = mockStore.getBlacklist().length;
      const entry = mockStore.addBlacklist({
        zoom_username: 'new_banned_user',
        reason: 'テストBAN',
        ban_type: 'permanent',
      });
      expect(entry.id).toBeDefined();
      expect(entry.zoom_username).toBe('new_banned_user');
      expect(entry.is_active).toBe(true);
      expect(mockStore.getBlacklist().length).toBe(initialCount + 1);
    });

    it('deactivateBlacklist でBAN解除できる', () => {
      const list = mockStore.getBlacklist();
      const target = list[list.length - 1];
      const result = mockStore.deactivateBlacklist(target.id);
      expect(result).toBe(true);
    });

    it('存在しないIDのdeactivateは false を返す', () => {
      const result = mockStore.deactivateBlacklist('nonexistent');
      expect(result).toBe(false);
    });

    it('updateBlacklist でBAN種別を更新できる', () => {
      const list = mockStore.getBlacklist();
      const target = list[0];
      const updated = mockStore.updateBlacklist(target.id, {
        ban_type: 'temporary',
        expires_at: '2026-12-31T23:59:59Z',
      });
      expect(updated).not.toBeNull();
      expect(updated!.ban_type).toBe('temporary');
      expect(updated!.expires_at).toBe('2026-12-31T23:59:59Z');
    });

    it('存在しないIDのupdateは null を返す', () => {
      const result = mockStore.updateBlacklist('nonexistent', { ban_type: 'permanent' });
      expect(result).toBeNull();
    });
  });

  describe('Settings', () => {
    it('getSettings で設定を取得できる', () => {
      const settings = mockStore.getSettings();
      expect(settings).toBeDefined();
      expect(settings.ai_threshold).toBeDefined();
    });

    it('updateSetting で設定を更新できる', () => {
      const result = mockStore.updateSetting('ai_threshold', { value: 0.8 });
      expect(result.key).toBe('ai_threshold');
      expect(result.value).toEqual({ value: 0.8 });

      const settings = mockStore.getSettings();
      expect(settings.ai_threshold).toEqual({ value: 0.8 });
    });
  });

  describe('Bot Control', () => {
    afterEach(() => {
      // テスト後にBotを停止しておく
      try { mockStore.stopBot(); } catch { /* ignore */ }
    });

    it('startBot でBotを起動できる', () => {
      const result = mockStore.startBot('webinar-123', 'テストウェビナー');
      expect(result).toEqual({ ok: true });

      const status = mockStore.getBotStatus();
      expect(status.isRunning).toBe(true);
      expect(status.webinar_id).toBe('webinar-123');
      expect(status.webinar_name).toBe('テストウェビナー');
    });

    it('二重起動はエラーを返す', () => {
      mockStore.startBot('webinar-123', 'テスト');
      const result = mockStore.startBot('webinar-456', 'テスト2');
      expect(result).toEqual({ error: 'Bot is already running' });
    });

    it('stopBot でBotを停止できる', () => {
      mockStore.startBot('webinar-123', 'テスト');
      const result = mockStore.stopBot();
      expect(result).toEqual({ ok: true });

      const status = mockStore.getBotStatus();
      expect(status.isRunning).toBe(false);
    });

    it('停止中のBot停止はエラーを返す', () => {
      const result = mockStore.stopBot();
      expect(result).toEqual({ error: 'Bot is not running' });
    });

    it('getBotStatus で初期状態を返す', () => {
      const status = mockStore.getBotStatus();
      expect(status.isRunning).toBe(false);
      expect(status.processedCount).toBe(0);
    });
  });

  describe('Auth', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    it('デフォルトパスワード "admin" で認証成功', () => {
      delete process.env.BOT_ADMIN_PASSWORD;
      expect(mockStore.checkPassword('admin')).toBe(true);
    });

    it('間違ったパスワードで認証失敗', () => {
      delete process.env.BOT_ADMIN_PASSWORD;
      expect(mockStore.checkPassword('wrong')).toBe(false);
    });

    it('環境変数のパスワードで認証成功', () => {
      process.env.BOT_ADMIN_PASSWORD = 'custom-pass';
      expect(mockStore.checkPassword('custom-pass')).toBe(true);
    });
  });
});
