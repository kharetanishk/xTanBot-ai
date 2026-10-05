#!/usr/bin/env bash
# Run on the VM from the repo root: bash infrastructure/deploy/deploy.sh
# First run and every redeploy use the same script.
set -euo pipefail
cd "$(dirname "$0")/../.."

WEB_ROOT=/var/www/xtanbot
API_PUBLIC_URL=https://xtanbot-api.lunarnodes.co.in

git pull --ff-only
pnpm install --frozen-lockfile

# Postgres + Redis (localhost only)
docker compose -f infrastructure/docker/docker-compose.yml up -d --wait

pnpm build
set -a; . ./.env; set +a
pnpm --filter @xtanbot/db exec prisma migrate deploy

# Web frontend -> static files served by nginx
(cd apps/mobile && EXPO_PUBLIC_API_URL=$API_PUBLIC_URL npx expo export --platform web)
mkdir -p "$WEB_ROOT"
rsync -a --delete apps/mobile/dist/ "$WEB_ROOT/"

# Backend processes
pm2 restart xtanbot-api    2>/dev/null || pm2 start apps/api/dist/index.js         --name xtanbot-api
pm2 restart xtanbot-worker 2>/dev/null || pm2 start apps/worker/dist/index.js      --name xtanbot-worker
pm2 restart xtanbot-voice  2>/dev/null || pm2 start apps/voice-agent/dist/index.js --name xtanbot-voice -- start
pm2 save

curl -fsS "http://127.0.0.1:${API_PORT:-3000}/health" && echo " ✓ deployed"
