#!/bin/bash
set -euo pipefail

# =============================================
# Zoom Mod Bot - VPS デプロイスクリプト
# =============================================

APP_DIR="/opt/zoom-mod-bot"
NODE_VERSION="20"

echo "=== Zoom Mod Bot デプロイ ==="

# 1. Node.js 確認
if ! command -v node &> /dev/null; then
  echo "[ERROR] Node.js が見つかりません。v${NODE_VERSION}+ をインストールしてください。"
  exit 1
fi

NODE_ACTUAL=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_ACTUAL" -lt "$NODE_VERSION" ]; then
  echo "[ERROR] Node.js v${NODE_VERSION}+ が必要です（現在: v$(node -v)）"
  exit 1
fi
echo "[OK] Node.js $(node -v)"

# 2. PM2 確認
if ! command -v pm2 &> /dev/null; then
  echo "[INSTALL] PM2 をインストール中..."
  npm install -g pm2
fi
echo "[OK] PM2 $(pm2 -v)"

# 3. gog CLI 確認
if ! command -v gog &> /dev/null; then
  echo "[WARN] gog CLI が見つかりません。Google Sheets 連携には gog CLI が必要です。"
  echo "       インストール: brew install steipete/tap/gogcli"
  echo "       認証: gog auth add your@email.com"
else
  echo "[OK] gog CLI $(gog --version 2>/dev/null | head -1)"
fi

# 4. 依存関係インストール
echo "[STEP] npm install..."
npm ci --production=false

# 5. ビルド
echo "[STEP] npm run build..."
npm run build

# 6. .env.local 確認
if [ ! -f .env.local ]; then
  echo "[ERROR] .env.local が見つかりません。.env.example をコピーして設定してください。"
  echo "        cp .env.example .env.local"
  exit 1
fi
echo "[OK] .env.local 存在確認"

# 7. PM2 起動
echo "[STEP] PM2 で起動..."
pm2 delete zoom-mod-bot 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save

echo ""
echo "=== デプロイ完了 ==="
echo "  URL: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost'):3000"
echo "  ログ: pm2 logs zoom-mod-bot"
echo "  停止: pm2 stop zoom-mod-bot"
echo "  再起動: pm2 restart zoom-mod-bot"
