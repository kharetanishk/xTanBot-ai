# xTanBot.ai — Development Startup Script
# Run this from repo root: .\start-dev.ps1

Write-Host "Starting xTanBot.ai development..." -ForegroundColor Yellow

# Step 1: Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Cyan
pnpm install

# Step 2: Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Cyan
pnpm --filter @xtanbot/db exec prisma generate

# Step 3: Build all packages in order
Write-Host "Building packages..." -ForegroundColor Cyan
pnpm --filter @xtanbot/config build
pnpm --filter @xtanbot/zod-schemas build
pnpm --filter @xtanbot/logger build
pnpm --filter @xtanbot/redis build
pnpm --filter @xtanbot/db build
pnpm --filter @xtanbot/events build
pnpm --filter @xtanbot/queues build
pnpm --filter @xtanbot/observability build
pnpm --filter @xtanbot/ai-core build
pnpm --filter @xtanbot/voice-pipeline build

Write-Host "All packages built successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Now start these in separate terminals:" -ForegroundColor Yellow
Write-Host "  Terminal 1: pnpm --filter @xtanbot/api dev" -ForegroundColor White
Write-Host "  Terminal 2: pnpm --filter @xtanbot/worker dev" -ForegroundColor White
Write-Host "  Terminal 3: cd apps/mobile && npx expo start --clear" -ForegroundColor White
