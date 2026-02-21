# =============================================
# Zoom Moderation Bot - Fly.io Production Dockerfile
# =============================================

# --- Stage 1: 依存関係インストール ---
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# --- Stage 2: ビルド ---
FROM node:20-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# --- Stage 3: 本番実行 ---
FROM node:20-slim AS runner
WORKDIR /app

# Chromium の依存ライブラリ + gog CLI インストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    ca-certificates \
    curl \
    dumb-init \
    && ARCH=$(dpkg --print-architecture) \
    && curl -fsSL "https://github.com/steipete/gogcli/releases/latest/download/gog_linux_${ARCH}" -o /usr/local/bin/gog \
    && chmod +x /usr/local/bin/gog \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer がシステムの Chromium を使うように設定
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# 非root ユーザーで実行
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 nextjs

# ビルド成果物をコピー
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs

EXPOSE 3000

# dumb-init でシグナルを適切にハンドリング
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
