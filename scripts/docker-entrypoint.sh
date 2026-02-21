#!/bin/sh

# gog CLI のセットアップ (環境変数 GOG_TOKEN が設定されている場合)
if [ -n "$GOG_TOKEN" ]; then
  echo "[Docker] Setting up gog CLI credentials..."

  # gog config ディレクトリ作成
  GOG_DIR="$HOME/.config/gogcli"
  mkdir -p "$GOG_DIR" 2>/dev/null || true

  # file keyring バックエンドを使用
  gog auth keyring file --no-input 2>/dev/null || true

  # トークンファイルを一時作成してインポート
  TOKEN_FILE="/tmp/gog-token-import.json"
  echo "$GOG_TOKEN" > "$TOKEN_FILE"
  gog auth tokens import "$TOKEN_FILE" --no-input 2>/dev/null && echo "[Docker] gog token imported" || echo "[Docker] Warning: gog token import failed"
  rm -f "$TOKEN_FILE"

  echo "[Docker] gog CLI setup complete"
fi

# アプリケーション起動
exec "$@"
