-- =============================================
-- Zoom Moderation Bot - テーブル作成マイグレーション
-- =============================================

-- 1. NGワードテーブル
CREATE TABLE IF NOT EXISTS ng_words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  severity TEXT DEFAULT 'medium',
  is_regex BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE ng_words IS 'NGワードリスト';
COMMENT ON COLUMN ng_words.word IS 'NGワード文字列';
COMMENT ON COLUMN ng_words.category IS 'カテゴリ（暴言、スパム等）';
COMMENT ON COLUMN ng_words.severity IS '重要度（high/medium/low）';
COMMENT ON COLUMN ng_words.is_regex IS '正規表現かどうか';

-- 2. ブラックリスト（BAN済みユーザー）
CREATE TABLE IF NOT EXISTS blacklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_username TEXT NOT NULL,
  zoom_email TEXT,
  reason TEXT,
  original_message TEXT,
  ai_score FLOAT,
  ban_type TEXT DEFAULT 'permanent',
  banned_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  webinar_id TEXT,
  webinar_name TEXT,
  sheets_synced BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT unique_zoom_username UNIQUE (zoom_username)
);

COMMENT ON TABLE blacklist IS 'BAN済みユーザーリスト';
COMMENT ON COLUMN blacklist.ban_type IS 'permanent or temporary';
COMMENT ON COLUMN blacklist.sheets_synced IS 'Google Sheetsに同期済みか';
COMMENT ON COLUMN blacklist.is_active IS 'BANが有効かどうか';

CREATE INDEX idx_blacklist_active ON blacklist (is_active) WHERE is_active = true;
CREATE INDEX idx_blacklist_username ON blacklist (zoom_username);

-- 3. モデレーションログ
CREATE TABLE IF NOT EXISTS mod_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  webinar_id TEXT,
  webinar_name TEXT,
  username TEXT,
  message TEXT,
  action TEXT,
  detection_method TEXT,
  ai_score FLOAT,
  ai_reason TEXT,
  ai_category TEXT,
  matched_word TEXT
);

COMMENT ON TABLE mod_logs IS 'モデレーション処理ログ';
COMMENT ON COLUMN mod_logs.action IS 'kicked/deleted/warned/passed/re-blocked';
COMMENT ON COLUMN mod_logs.detection_method IS 'ngword/ai/blacklist';

CREATE INDEX idx_mod_logs_created_at ON mod_logs (created_at DESC);
CREATE INDEX idx_mod_logs_action ON mod_logs (action);

-- 4. Bot設定（Key-Valueストア）
CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_setting_key UNIQUE (key)
);

COMMENT ON TABLE bot_settings IS 'Bot設定のKey-Valueストア';

-- 初期設定データ投入
INSERT INTO bot_settings (key, value) VALUES
  ('ai_threshold', '{"value": 0.6}'::jsonb),
  ('auto_delete', '{"value": true}'::jsonb),
  ('auto_kick', '{"value": true}'::jsonb),
  ('block_reentry', '{"value": true}'::jsonb),
  ('sheets_sync', '{"value": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 初期NGワード投入（よくある暴言）
INSERT INTO ng_words (word, category, severity, is_regex) VALUES
  ('死ね', '暴言', 'high', false),
  ('殺す', '暴言', 'high', false),
  ('消えろ', '暴言', 'high', false)
ON CONFLICT DO NOTHING;

-- 5. Realtime 有効化（ダッシュボードのリアルタイム更新用）
ALTER PUBLICATION supabase_realtime ADD TABLE mod_logs;

-- 6. RLS（Row Level Security）ポリシー
ALTER TABLE ng_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE mod_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- サービスロール（バックエンド）は全操作可能
CREATE POLICY "Service role full access" ON ng_words FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON blacklist FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON mod_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON bot_settings FOR ALL USING (auth.role() = 'service_role');

-- 匿名キー（フロントエンド）は mod_logs の読み取りのみ（Realtime用）
CREATE POLICY "Anon read mod_logs" ON mod_logs FOR SELECT USING (auth.role() = 'anon');
