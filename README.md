# xTanBot.ai

> Production-grade AI voice assistant platform — scheduling, phone calls, and natural voice powered by Claude.

---

## What is xTanBot?

xTanBot is an AI voice assistant that answers your phone calls, schedules meetings, manages contacts, and handles tasks — all through natural conversation. Built on Anthropic's Claude, Twilio, Deepgram, and ElevenLabs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Twilio                               │
│         Inbound/Outbound Calls + Media Streams              │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket (audio)
┌───────────────────────▼─────────────────────────────────────┐
│                    apps/api (Fastify)                        │
│   /twilio/voice  /twilio/stream  /calls  /meetings          │
└───────┬───────────────────────────────────┬─────────────────┘
        │                                   │
        ▼                                   ▼
┌───────────────┐                 ┌─────────────────────┐
│ voice-pipeline│                 │   Redis + BullMQ    │
│  Deepgram STT │────transcript──▶│   Job Queues        │
│  ElevenLabs   │◀───audio────────│                     │
│  TTS          │                 └──────────┬──────────┘
└───────────────┘                            │
                                             ▼
                                  ┌─────────────────────┐
                                  │   apps/worker       │
                                  │   AgentWorker       │
                                  │   runAgent()        │
                                  └──────────┬──────────┘
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │  @xtanbot/ai-core   │
                                  │  Claude (Anthropic) │
                                  │  Tool Router        │
                                  │  schedule_meeting   │
                                  │  make_call          │
                                  │  lookup_contact     │
                                  │  get_current_time   │
                                  └──────────┬──────────┘
                                             │
                                             ▼
                                  ┌─────────────────────┐
                                  │  @xtanbot/db        │
                                  │  PostgreSQL/Prisma  │
                                  │  Users/Calls/       │
                                  │  Meetings/Contacts  │
                                  └─────────────────────┘
```

---

## Monorepo Structure

```
xtanbot-ai/
├── apps/
│   ├── api/          — Fastify HTTP + WebSocket server
│   ├── worker/       — BullMQ job workers
│   └── mobile/       — React Native + Expo (Day 4)
├── packages/
│   ├── ai-core/      — Claude client, tool router, runAgent()
│   ├── config/       — Zod-validated environment singleton
│   ├── db/           — Prisma client + repositories
│   ├── events/       — Domain event schemas + Redis pub/sub
│   ├── logger/       — Pino structured logger
│   ├── queues/       — BullMQ queue definitions + job producers
│   ├── redis/        — IORedis client, session helpers, rate limiter
│   ├── tsconfig/     — Shared TypeScript configs
│   ├── voice-pipeline/ — Twilio stream, Deepgram STT, ElevenLabs TTS
│   └── zod-schemas/  — All domain Zod schemas + types
└── infrastructure/
    └── docker/       — Docker Compose (Postgres + Redis)
```

---

## Tech Stack

| Layer         | Technology                           |
| ------------- | ------------------------------------ |
| AI            | Anthropic Claude (claude-sonnet-4-5) |
| Voice         | Twilio Media Streams                 |
| STT           | Deepgram Nova-2                      |
| TTS           | ElevenLabs Turbo v2.5                |
| API           | Fastify 4                            |
| Database      | PostgreSQL 16 + Prisma               |
| Cache / Queue | Redis 7 + BullMQ                     |
| Mobile        | React Native + Expo                  |
| Language      | TypeScript (strict)                  |
| Monorepo      | pnpm workspaces + Turborepo          |

---

## Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker Desktop

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/kharetanishk/xTanBot-ai.git
cd xtanbot-ai
pnpm install
```

### 2. Environment setup

```bash
cp .env.example .env
```

Fill in your `.env`:

```ini
# App
NODE_ENV=development
API_PORT=3000
API_HOST=0.0.0.0

# Database
DATABASE_URL=postgresql:xxx

# Redis
REDIS_URL=redis:xxx

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_turbo_v2_5

# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...

# Deepgram
DEEPGRAM_API_KEY=...

# Auth
JWT_SECRET=your-32-character-secret-here
JWT_EXPIRES_IN=7d
```

### 3. Start infrastructure

```bash
pnpm docker:up
```

### 4. Run database migrations

```bash
pnpm db:migrate
```

### 5. Build all packages

```bash
pnpm build
```

### 6. Start API server

```bash
cd apps/api
pnpm dev
```

### 7. Start worker (separate terminal)

```bash
cd apps/worker
pnpm dev
```

---

## API Reference

### Auth

| Method | Endpoint    | Description                |
| ------ | ----------- | -------------------------- |
| POST   | `/users`    | Register user, returns JWT |
| GET    | `/users/me` | Get current user           |

### Calls

| Method | Endpoint     | Description            |
| ------ | ------------ | ---------------------- |
| POST   | `/calls`     | Initiate outbound call |
| GET    | `/calls`     | List user calls        |
| GET    | `/calls/:id` | Get call by ID         |

### Meetings

| Method | Endpoint             | Description           |
| ------ | -------------------- | --------------------- |
| POST   | `/meetings`          | Schedule meeting      |
| GET    | `/meetings`          | List user meetings    |
| GET    | `/meetings/upcoming` | Get upcoming meetings |
| GET    | `/meetings/:id`      | Get meeting by ID     |
| PATCH  | `/meetings/:id`      | Update meeting        |
| DELETE | `/meetings/:id`      | Cancel meeting        |

### Contacts

| Method | Endpoint        | Description                           |
| ------ | --------------- | ------------------------------------- |
| POST   | `/contacts`     | Create contact                        |
| GET    | `/contacts`     | List contacts (supports `?q=` search) |
| GET    | `/contacts/:id` | Get contact by ID                     |
| PATCH  | `/contacts/:id` | Update contact                        |
| DELETE | `/contacts/:id` | Delete contact                        |

### System

| Method | Endpoint         | Description                     |
| ------ | ---------------- | ------------------------------- |
| GET    | `/health`        | API, database, and Redis health |
| POST   | `/twilio/voice`  | Twilio inbound call webhook     |
| POST   | `/twilio/status` | Twilio call status webhook      |
| WS     | `/twilio/stream` | Twilio media stream WebSocket   |

---

## AI Tools

Claude has access to these tools during voice calls:

| Tool               | Description                         |
| ------------------ | ----------------------------------- |
| `schedule_meeting` | Book a meeting with attendees       |
| `make_call`        | Initiate a phone call               |
| `lookup_contact`   | Search contacts by name/email/phone |
| `get_current_time` | Get current time in any timezone    |

---

## Development

### Useful commands

```bash
# Build everything
pnpm build

# Build a specific package
pnpm --filter @xtanbot/ai-core build

# Run database migrations
pnpm db:migrate

# Open Prisma Studio
pnpm --filter @xtanbot/db db:studio

# Start Docker services
pnpm docker:up

# Stop Docker services
pnpm docker:down
```

### Adding a new tool

1. Create `packages/ai-core/src/tools/your-tool.tool.ts`
2. Implement `ToolDefinition` interface
3. Add to `packages/ai-core/src/tools/index.ts`
4. Rebuild `@xtanbot/ai-core`

### Adding a new API route

1. Create `apps/api/src/routes/your.route.ts`
2. Register in `apps/api/src/index.ts`
3. Add service in `apps/api/src/services/`

---

## Environment Variables Reference

| Variable                       | Required | Default             | Description                          |
| ------------------------------ | -------- | ------------------- | ------------------------------------ |
| `NODE_ENV`                     | No       | `development`       | Environment                          |
| `API_PORT`                     | No       | `3000`              | API server port                      |
| `API_HOST`                     | No       | `0.0.0.0`           | API server host                      |
| `DATABASE_URL`                 | Yes      | —                   | PostgreSQL connection URL            |
| `REDIS_URL`                    | Yes      | —                   | Redis connection URL                 |
| `ANTHROPIC_API_KEY`            | Yes      | —                   | Anthropic API key                    |
| `ANTHROPIC_MODEL`              | No       | `claude-sonnet-4-5` | Claude model                         |
| `ELEVENLABS_API_KEY`           | Yes      | —                   | ElevenLabs API key                   |
| `ELEVENLABS_VOICE_ID`          | Yes      | —                   | ElevenLabs voice ID                  |
| `ELEVENLABS_MODEL_ID`          | No       | `eleven_turbo_v2_5` | ElevenLabs model                     |
| `TWILIO_ACCOUNT_SID`           | Yes      | —                   | Twilio account SID                   |
| `TWILIO_AUTH_TOKEN`            | Yes      | —                   | Twilio auth token                    |
| `TWILIO_PHONE_NUMBER`          | Yes      | —                   | Twilio phone number                  |
| `DEEPGRAM_API_KEY`             | No       | —                   | Deepgram API key                     |
| `JWT_SECRET`                   | Yes      | —                   | JWT signing secret (min 32 chars)    |
| `JWT_EXPIRES_IN`               | No       | `7d`                | JWT expiry                           |
| `WORKER_CONCURRENCY`           | No       | `10`                | BullMQ worker concurrency            |
| `RATE_LIMIT_CALLS_PER_HOUR`    | No       | `20`                | Max calls per user per hour          |
| `RATE_LIMIT_AI_RPM`            | No       | `60`                | Max AI requests per minute           |
| `VOICE_SESSION_MAX_DURATION_S` | No       | `1800`              | Max voice session duration (seconds) |

---

## License

MIT
