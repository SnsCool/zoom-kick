// src/lib/mock-data.ts - ローカルテスト用モックデータ & インメモリストア
// MOCK_MODE=true のとき外部サービス(Supabase/Zoom/Gemini等)を使わずに動作

export const isMockMode = () => process.env.MOCK_MODE === 'true';

// --- インメモリストア ---
let nextLogId = 11;
let nextNgWordId = 4;
let nextBlacklistId = 4;

const mockLogs = [
  {
    id: 1,
    created_at: '2025-01-15T10:30:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'troll_user_1',
    message: 'ここで宣伝させてもらいます！ https://spam.example.com',
    action: 'kicked',
    detection_method: 'ai',
    ai_score: 0.95,
    ai_reason: 'スパムリンクを含む宣伝行為',
    ai_category: 'spam',
    matched_word: null,
  },
  {
    id: 2,
    created_at: '2025-01-15T10:32:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'angry_viewer',
    message: '死ね！このイベント最悪だ',
    action: 'kicked',
    detection_method: 'ngword',
    ai_score: 1.0,
    ai_reason: 'NGワード検出: 死ね',
    ai_category: 'hate',
    matched_word: '死ね',
  },
  {
    id: 3,
    created_at: '2025-01-15T10:35:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'normal_user',
    message: '今日の発表とても参考になりました！',
    action: 'passed',
    detection_method: 'ai',
    ai_score: 0.05,
    ai_reason: '問題なし',
    ai_category: 'clean',
    matched_word: null,
  },
  {
    id: 4,
    created_at: '2025-01-15T10:38:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'spammer_2',
    message: '副業で月100万！詳しくはDMで',
    action: 'deleted',
    detection_method: 'ai',
    ai_score: 0.72,
    ai_reason: '副業勧誘スパムの疑い',
    ai_category: 'spam',
    matched_word: null,
  },
  {
    id: 5,
    created_at: '2025-01-15T10:40:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'viewer_a',
    message: '質問があります。資料はどこからダウンロードできますか？',
    action: 'passed',
    detection_method: 'ai',
    ai_score: 0.02,
    ai_reason: '通常の質問',
    ai_category: 'clean',
    matched_word: null,
  },
  {
    id: 6,
    created_at: '2025-01-15T10:42:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'troll_user_1',
    message: '(再入室検知)',
    action: 're-blocked',
    detection_method: 'blacklist',
    ai_score: 0,
    ai_reason: '再入室ブロック',
    ai_category: '',
    matched_word: null,
  },
  {
    id: 7,
    created_at: '2025-01-15T10:45:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'harasser_1',
    message: 'この発表者ブスすぎｗｗｗ',
    action: 'kicked',
    detection_method: 'ai',
    ai_score: 0.92,
    ai_reason: '容姿に対する侮辱・ハラスメント',
    ai_category: 'harassment',
    matched_word: null,
  },
  {
    id: 8,
    created_at: '2025-01-15T10:48:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'nice_person',
    message: 'ありがとうございます！勉強になります',
    action: 'passed',
    detection_method: 'ai',
    ai_score: 0.01,
    ai_reason: '問題なし',
    ai_category: 'clean',
    matched_word: null,
  },
  {
    id: 9,
    created_at: '2025-01-15T10:50:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'edge_case',
    message: 'ちょっとこの内容おかしくない？嘘ばっかり',
    action: 'deleted',
    detection_method: 'ai',
    ai_score: 0.65,
    ai_reason: '批判的だが境界線上',
    ai_category: 'troll',
    matched_word: null,
  },
  {
    id: 10,
    created_at: '2025-01-15T10:52:00Z',
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    username: 'viewer_b',
    message: '次のスライドお願いします',
    action: 'passed',
    detection_method: 'ai',
    ai_score: 0.0,
    ai_reason: '通常の発言',
    ai_category: 'clean',
    matched_word: null,
  },
];

const mockNgWords = [
  { id: '1', word: '死ね', category: '暴言', severity: 'high', is_regex: false, created_at: '2025-01-01T00:00:00Z' },
  { id: '2', word: '殺す', category: '暴言', severity: 'high', is_regex: false, created_at: '2025-01-01T00:00:00Z' },
  { id: '3', word: 'https?://\\S+', category: 'スパム', severity: 'medium', is_regex: true, created_at: '2025-01-01T00:00:00Z' },
];

type MockBlacklistEntry = {
  id: string;
  zoom_username: string;
  zoom_email: string | null;
  reason: string;
  original_message: string | null;
  ai_score: number | null;
  ban_type: string;
  banned_at: string;
  expires_at: string | null;
  webinar_id: string | null;
  webinar_name: string | null;
  sheets_synced: boolean;
  is_active: boolean;
};

const mockBlacklist: MockBlacklistEntry[] = [
  {
    id: '1',
    zoom_username: 'troll_user_1',
    zoom_email: 'troll@example.com',
    reason: 'スパムリンクを含む宣伝行為',
    original_message: 'ここで宣伝させてもらいます！ https://spam.example.com',
    ai_score: 0.95,
    ban_type: 'permanent',
    banned_at: '2025-01-15T10:30:00Z',
    expires_at: null,
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    sheets_synced: true,
    is_active: true,
  },
  {
    id: '2',
    zoom_username: 'angry_viewer',
    zoom_email: null,
    reason: 'NGワード検出: 死ね',
    original_message: '死ね！このイベント最悪だ',
    ai_score: 1.0,
    ban_type: 'permanent',
    banned_at: '2025-01-15T10:32:00Z',
    expires_at: null,
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    sheets_synced: true,
    is_active: true,
  },
  {
    id: '3',
    zoom_username: 'harasser_1',
    zoom_email: 'harasser@example.com',
    reason: '容姿に対する侮辱・ハラスメント',
    original_message: 'この発表者ブスすぎｗｗｗ',
    ai_score: 0.92,
    ban_type: 'permanent',
    banned_at: '2025-01-15T10:45:00Z',
    expires_at: null,
    webinar_id: '123456789',
    webinar_name: 'テストウェビナー',
    sheets_synced: false,
    is_active: true,
  },
];

const mockSettings: Record<string, Record<string, unknown>> = {
  ai_threshold: { value: 0.6 },
  auto_delete: { value: true },
  auto_kick: { value: true },
  block_reentry: { value: true },
  sheets_sync: { value: true },
  current_webinar: { webinar_id: '123456789', webinar_name: 'テストウェビナー' },
};

// --- Mock Bot State ---
let mockBotRunning = false;
let mockBotStartedAt: string | null = null;
let mockBotWebinarId: string | null = null;
let mockBotWebinarName: string | null = null;
let mockProcessedCount = 0;
let mockBotInterval: NodeJS.Timeout | null = null;

// --- CRUD Operations ---

export const mockStore = {
  // Logs
  getLogs(limit = 50, offset = 0, action?: string) {
    let filtered = [...mockLogs];
    if (action) {
      filtered = filtered.filter(l => l.action === action);
    }
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return {
      data: filtered.slice(offset, offset + limit),
      total: filtered.length,
      banned: mockLogs.filter(l => l.action === 'kicked').length,
      deleted: mockLogs.filter(l => l.action === 'deleted').length,
      passed: mockLogs.filter(l => l.action === 'passed').length,
    };
  },

  addLog(log: Partial<(typeof mockLogs)[0]>) {
    const newLog = {
      id: nextLogId++,
      created_at: new Date().toISOString(),
      webinar_id: '',
      webinar_name: '',
      username: '',
      message: '',
      action: 'passed',
      detection_method: 'ai',
      ai_score: 0,
      ai_reason: '',
      ai_category: '',
      matched_word: null,
      ...log,
    };
    mockLogs.push(newLog);
    return newLog;
  },

  // NG Words
  getNgWords() {
    return [...mockNgWords];
  },

  addNgWord(word: { word: string; category: string; severity: string; is_regex: boolean }) {
    const newWord = {
      id: String(nextNgWordId++),
      ...word,
      created_at: new Date().toISOString(),
    };
    mockNgWords.push(newWord);
    return newWord;
  },

  deleteNgWord(id: string) {
    const idx = mockNgWords.findIndex(w => w.id === id);
    if (idx !== -1) {
      mockNgWords.splice(idx, 1);
      return true;
    }
    return false;
  },

  // Blacklist
  getBlacklist() {
    return [...mockBlacklist].sort(
      (a, b) => new Date(b.banned_at).getTime() - new Date(a.banned_at).getTime()
    );
  },

  addBlacklist(entry: {
    zoom_username: string;
    zoom_email?: string | null;
    reason: string;
    ban_type: string;
    expires_at?: string | null;
    webinar_id?: string | null;
    webinar_name?: string | null;
  }) {
    const newEntry = {
      id: String(nextBlacklistId++),
      zoom_username: entry.zoom_username,
      zoom_email: entry.zoom_email ?? null,
      reason: entry.reason,
      original_message: null as string | null,
      ai_score: null as number | null,
      ban_type: entry.ban_type,
      banned_at: new Date().toISOString(),
      expires_at: entry.expires_at ?? null,
      webinar_id: entry.webinar_id ?? null,
      webinar_name: entry.webinar_name ?? null,
      sheets_synced: false,
      is_active: true,
    };
    mockBlacklist.push(newEntry);
    return newEntry;
  },

  deactivateBlacklist(id: string) {
    const entry = mockBlacklist.find(e => e.id === id);
    if (entry) {
      entry.is_active = false;
      return true;
    }
    return false;
  },

  updateBlacklist(id: string, updates: { ban_type?: string; expires_at?: string | null }) {
    const entry = mockBlacklist.find(e => e.id === id);
    if (entry) {
      if (updates.ban_type) entry.ban_type = updates.ban_type;
      if (updates.expires_at !== undefined) entry.expires_at = updates.expires_at as typeof entry.expires_at;
      return entry;
    }
    return null;
  },

  // Settings
  getSettings() {
    return { ...mockSettings };
  },

  updateSetting(key: string, value: Record<string, unknown>) {
    mockSettings[key] = value;
    return { key, value };
  },

  // Bot Control
  startBot(webinarId: string, webinarName: string) {
    if (mockBotRunning) return { error: 'Bot is already running' };
    mockBotRunning = true;
    mockBotStartedAt = new Date().toISOString();
    mockBotWebinarId = webinarId;
    mockBotWebinarName = webinarName;
    mockProcessedCount = 0;

    // シミュレーション: 5秒ごとにダミーメッセージを処理
    mockBotInterval = setInterval(() => {
      mockProcessedCount++;
      const sampleMessages = [
        { username: 'user_' + Math.floor(Math.random() * 100), message: '質問です！', action: 'passed', score: 0.02 },
        { username: 'spam_bot', message: '副業で稼ごう！', action: 'deleted', score: 0.75 },
        { username: 'viewer_' + Math.floor(Math.random() * 50), message: 'なるほど！', action: 'passed', score: 0.01 },
      ];
      const sample = sampleMessages[Math.floor(Math.random() * sampleMessages.length)];
      mockStore.addLog({
        webinar_id: webinarId,
        webinar_name: webinarName,
        username: sample.username,
        message: sample.message,
        action: sample.action,
        detection_method: 'ai',
        ai_score: sample.score,
        ai_reason: sample.action === 'passed' ? '問題なし' : 'スパムの疑い',
        ai_category: sample.action === 'passed' ? 'clean' : 'spam',
        matched_word: null,
      });
    }, 5000);

    return { ok: true };
  },

  stopBot() {
    if (!mockBotRunning) return { error: 'Bot is not running' };
    mockBotRunning = false;
    if (mockBotInterval) {
      clearInterval(mockBotInterval);
      mockBotInterval = null;
    }
    mockBotStartedAt = null;
    mockBotWebinarId = null;
    mockBotWebinarName = null;
    return { ok: true };
  },

  getBotStatus() {
    return {
      isRunning: mockBotRunning,
      is_running: mockBotRunning,
      processedCount: mockProcessedCount,
      webinar_id: mockBotWebinarId,
      webinarId: mockBotWebinarId,
      webinar_name: mockBotWebinarName,
      webinarName: mockBotWebinarName,
      started_at: mockBotStartedAt,
      startedAt: mockBotStartedAt,
    };
  },

  // Auth
  checkPassword(password: string) {
    // モックモードでは "admin" をパスワードとして受け付ける
    return password === (process.env.BOT_ADMIN_PASSWORD || 'admin');
  },
};
