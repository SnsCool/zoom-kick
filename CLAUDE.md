# CLAUDE.md - Zoom Webinar 自動モデレーション Bot

## このプロジェクトについて

Zoomウェビナーのチャットを自動監視し、アンチコメントを検出→削除→ユーザー退出→スプレッドシート記録→再入室ブロック まで自動で行うBotシステムです。

**仕様書は `/SPEC.md` に全て記載しています。実装前に必ず全文を読んでください。**

---

## 開発ルール

### 言語・コード規約

- TypeScript 必須（any 禁止、型は全て `src/types/index.ts` に集約）
- React コンポーネントは関数コンポーネント + Hooks のみ
- CSS は Tailwind CSS のみ使用（inline style, CSS modules 禁止）
- async/await 統一（.then() チェーン禁止）
- console.log は `[Bot]`, `[AI]`, `[Sheets]` のようにプレフィックスを付ける
- エラーは try-catch で必ず処理し、安全側に倒す（AI判定エラー → パス扱い）
- 日本語コメントOK（このプロジェクトは日本語話者向け）

### ファイル構成のルール

- 1ファイル = 1責務（Bot本体、AI判定、Sheets連携 は全て別ファイル）
- 型定義は `src/types/index.ts` に集約（各ファイルでの個別定義禁止）
- 環境変数へのアクセスは各モジュールの初期化時のみ
- Botインスタンスは `src/bot/instance.ts` でシングルトン管理

### Git コミット規約

```
feat: 新機能追加
fix: バグ修正
refactor: リファクタリング
docs: ドキュメント変更
style: コード整形
```

---

## 技術スタック

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Puppeteer (headless Chrome でZoom Web Client を自動操作)
- Gemini 2.0 Flash API (AI判定)
- Supabase (PostgreSQL + Realtime)
- Google Sheets API (BAN記録)

---

## 開発順序

**SPEC.md のセクション13「開発の進め方」に従って、Phase 1 → Phase 8 の順番で進めてください。**

1. **Phase 1**: プロジェクト初期化 & DB (create-next-app, 型定義, Supabase接続)
2. **Phase 2**: NGワード管理 CRUD (API Route + UIコンポーネント)
3. **Phase 3**: AI判定モジュール (Gemini API呼び出し + プロンプト)
4. **Phase 4**: Bot Engine コア (Puppeteer, チャット監視, メッセージ削除, ユーザー退出)
5. **Phase 5**: Google Sheets 連携 (BAN記録の自動追記 + 読み込み)
6. **Phase 6**: Web Dashboard (全UI + Supabase Realtime)
7. **Phase 7**: デプロイ準備 (PM2設定, README)

各フェーズ完了時に動作確認ポイントがあるので、それをクリアしてから次に進むこと。

---

## 重要な実装上のポイント

### Puppeteer関連

- Zoom Web Client のDOMセレクタは**頻繁に変わる**。セレクタは必ず複数候補を配列で持ち、フォールバックで試行する設計にすること。
- `headless: true` (本番) / `headless: false` (デバッグ) を環境変数で切り替え可能にすること。
- Puppeteerの `page.exposeFunction()` でNode.js側の関数をブラウザ内に公開し、`page.evaluate()` でMutationObserverを注入する。

### チャット監視のセレクタ候補

```typescript
// チャットコンテナ
const CHAT_CONTAINER_SELECTORS = [
  '.chat-container__chat-list',
  '[class*="chat-message-list"]',
  '[data-testid="chat-message-list"]',
  '.virtuoso-grid-list',
  '#chat-list',
];

// 個別メッセージ
const MESSAGE_SELECTORS = [
  '[class*="chat-message"]',
  '[data-testid*="chat-message"]',
];

// ユーザー名
const USERNAME_SELECTORS = [
  '[class*="sender"]',
  '[class*="username"]',
  '[class*="display-name"]',
];

// メッセージ本文
const CONTENT_SELECTORS = [
  '[class*="content"]',
  '[class*="text-content"]',
  '[class*="message-content"]',
];
```

**これらのセレクタは実際のZoom Web Clientで確認して更新する必要がある。** 現時点では推測値であり、動かない可能性が高い。セレクタの設定を外部ファイルまたはDB設定に切り出して、コード変更なしで更新できるようにすることを推奨。

### AI判定のフロー

```
新メッセージ
  ↓
NGワード照合 (即時、0.1秒以下)
  ├── マッチ → 即座に削除+退出+記録 (AI判定をスキップ)
  └── マッチなし → Gemini API に送信 (0.5〜1秒)
       ├── score >= 0.8 → 削除+退出+BAN+記録
       ├── score >= threshold(デフォルト0.7) → 削除 (退出はしない)
       └── score < threshold → パス (ログのみ記録)
```

### Google Sheets の注意

- `googleapis` パッケージのサイズが大きいので、必要なモジュールだけimportすること
- `import { google } from 'googleapis'` ではなく `import { sheets_v4 } from 'googleapis'` のような限定importも検討
- スプレッドシートの「BAN履歴」シートは事前にヘッダー行を手動で作成しておく前提

### Supabase Realtime

`mod_logs` テーブルにINSERTされたデータをリアルタイムでフロントに配信する。
`ALTER PUBLICATION supabase_realtime ADD TABLE mod_logs;` をSQLで実行しておくこと。

---

## 使用コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 本番起動
npm run start

# 型チェック
npx tsc --noEmit
```

---

## ファイル参照

- **仕様書全文**: `/SPEC.md`
- **DB設計**: `/SPEC.md` セクション5
- **API設計**: `/SPEC.md` セクション12
- **UIデザイン参考**: ダークテーマ、色定義は `/SPEC.md` セクション11.2

---

## テスト方針

- ユニットテストは不要（プロトタイプフェーズ）
- 各Phase完了時に手動で動作確認
- Bot Engine のテストは `headless: false` で目視確認
- AI判定のテストは様々なメッセージパターンをconsole.logで確認
