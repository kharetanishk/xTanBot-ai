# xTanBot.ai

[![CI](https://github.com/kharetanishk/xTanBot-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/kharetanishk/xTanBot-ai/actions/workflows/ci.yml)

> A personal AI assistant you can talk to like a person: live voice conversation in the app, streaming text chat, and real phone calls, all sharing one agent with ten tools.

**Live: <https://xtanbot.lunarnodes.co.in>** (web app; the same Expo code base builds for iOS and Android)

xTanBot schedules meetings, looks up contacts, searches and reads the web, sets alarms, sends WhatsApp messages and places phone calls, all through natural conversation. The in-app voice mode works like ChatGPT's voice mode: you just talk, it answers out loud within about a second, and you can interrupt it mid-sentence.

---

## Three ways to talk to the same agent

| Channel | Transport | Pipeline |
|---|---|---|
| **In-app voice** | WebRTC via LiveKit Cloud | Silero VAD → Deepgram nova-3 (streaming, multilingual) → Gemini on Vertex AI → Deepgram Aura-2 (streaming) |
| **Text chat** | HTTPS, Server-Sent Events | Gemini, streamed token by token, with tool calls |
| **Phone calls** | Twilio Media Streams (μ-law 8 kHz WebSocket) | Deepgram STT → Gemini → ElevenLabs, sentence-chunked streaming |

All three share `@xtanbot/ai-core`: one system prompt builder, one tool router, one set of confirmation rules. A tool added once works in every channel.

> Real phone calls are paused while the project runs on Twilio's free tier (`PHONE_CALLS_ENABLED=false`). The agent says so honestly instead of pretending to call.

---

## Architecture

```
                    ┌──────────────────────────────── Expo app (web, iOS, Android) ─────────────────────────────────┐
                    │  Chat screen (SSE)          Voice screen (LiveKit WebRTC, live captions)                      │
                    └──────────┬──────────────────────────────────┬─────────────────────────────────────────────────┘
                               │ HTTPS                            │ WebRTC audio
                               ▼                                  ▼
 Twilio ──media WS──► apps/api (Fastify)                  LiveKit Cloud (SFU, semantic turn detector)
                       auth, REST, SSE chat,                      │
                       LiveKit token minting,                     ▼
                       /metrics, Bull Board            apps/voice-agent (LiveKit Agents worker)
                               │                         Silero VAD → Deepgram STT → Gemini → Deepgram TTS
                               │                         preemptive generation, tuned barge-in
                               ▼                                  │
                   Redis + BullMQ ──► apps/worker                 │
                   (calls, alarms,    (scheduled calls,           │
                    meetings)          post-call analysis)        │
                               │                                  │
                               └────────────┬─────────────────────┘
                                            ▼
                              @xtanbot/ai-core: runAgent(), tool router, 10 tools
                              LLM: Gemini on Vertex AI (OpenAI-compatible API)
                                            │
                                            ▼
                              PostgreSQL + Prisma (users, calls, meetings, contacts, alarms)
```

---

## Voice engineering

### In-app voice (`apps/voice-agent`)
- **Turn detection:** LiveKit Cloud's semantic end-of-turn model decides when you've finished a thought, so mid-sentence pauses don't trigger a reply. Once it's confident, the agent waits only 300 ms. Silero VAD marks speech end after 300 ms of silence (default 550 ms).
- **Preemptive generation:** the LLM *and* the TTS start while the turn is still being confirmed, so the reply is often ready by the time you stop.
- **Barge-in:** a one-word interruption ("stop", "wait", "no") cuts the agent off, but sounds shorter than 350 ms (coughs, bumps) don't. LiveKit's default ignores every interruption during the first 3 s of each reply as an echo warm-up, which made a 4 s reply effectively uninterruptible. The browser's WebRTC echo cancellation already handles echo, so the warm-up is 300 ms.
- **No dead air on tools:** slow tools (web search, calls, WhatsApp, scheduling) immediately trigger a short spoken acknowledgement ("One sec, let me check") while the tool runs.
- **Spoken-style output:** voice mode forces 1-2 sentence replies with no markdown, lists or URLs, and numbers and times written the way people say them. The current local time is injected into the instructions every minute, so "what time is it" needs no tool round trip.
- **Speech recognition:** Deepgram nova-3 in `multi` language mode for English and Hinglish code-switching, with smart formatting off because number reformatting delays every final transcript.
- **Latency instrumentation:** one log line per turn with the full breakdown: end-of-utterance delay, transcription delay, LLM time to first token, TTS time to first byte, and total turn time.

### Phone calls (`packages/voice-pipeline`)
- **Streaming:** the LLM reply is split into sentences as it streams, and each sentence is sent to TTS immediately, so the caller hears the first sentence while the rest is still being generated.
- **Barge-in:** Twilio sends comfort noise from the first packet, so barge-in is only armed once the greeting has started. A 750 ms grace period after each reply starts stops line echo from cancelling it. A real interruption sends Twilio a `clear` message to drop buffered audio.
- **Silence handling:** a prompt after 8 s of silence, and a polite hang-up after 10 s more.
- **Expressive voice:** ElevenLabs voice settings change with the conversation's mood.
- **Metrics:** Prometheus counters and histograms for active calls, barge-ins and time from final transcript to first reply audio, served on `/metrics`.

### Choosing the model
Measured on Vertex AI with streaming and tools attached: `gemini-3.5-flash-lite` reaches its first token in 0.85 to 1.5 s and calls tools correctly, so it runs voice and quick turns. `gemini-3.5-flash` handles harder chat turns. Larger thinking models took 2 to 17 s to first token and are not used in voice.

---

## Tools

| Tool | What it does |
|---|---|
| `schedule_meeting` | Book a meeting with attendees |
| `lookup_contact` | Search contacts by name, email or phone |
| `make_call` | Place a phone call on the user's behalf |
| `story_call` | A call that follows a script and a mood (a pitch, a persuasion, a story); the AI runs the whole call |
| `set_alarm` | A wake-up call at a set time |
| `send_whatsapp` | Send a WhatsApp message (MSG91) |
| `web_search` | Search the web (Serper) |
| `web_fetch` | Read a web page |
| `get_location` | The user's location |
| `get_current_time` | Current time in any timezone (text chat only; voice gets the time in its instructions) |

Tools marked `requiresConfirmation` (placing a call, sending a WhatsApp message) return a confirmation request instead of acting until the user says yes. `enrichToolInput` merges the authenticated user's context into tool arguments, so the model never has to guess a user ID.

---

## Monorepo structure

```
apps/
  api/            Fastify: REST, SSE chat, Twilio webhooks + media stream, LiveKit tokens, /metrics, Bull Board
  voice-agent/    LiveKit Agents worker for in-app voice
  worker/         BullMQ workers: scheduled calls, alarms, meeting calls, post-call analysis
  mobile/         Expo (React Native): web, iOS, Android
packages/
  ai-core/        LLM client (Vertex AI or OpenRouter), runAgent(), tool router, tools, prompts
  voice-pipeline/ Twilio stream handling, Deepgram STT, ElevenLabs TTS, phone-call turn-taking
  config/         Zod-validated environment, fails fast on bad config
  db/             Prisma schema, client and repositories
  events/         Domain events over Redis pub/sub
  queues/         BullMQ queue definitions and producers
  redis/          ioredis client, session helpers, rate limiter
  observability/  Prometheus metrics
  logger/         Pino structured logging
  zod-schemas/    Shared domain schemas and types
infrastructure/
  docker/         Postgres + Redis (localhost only)
  deploy/         VM deploy script and nginx config
```

## Tech stack

| Layer | Technology |
|---|---|
| LLM | Gemini 3.5 Flash and Flash Lite on Vertex AI (OpenRouter supported as an alternative) |
| Realtime voice | LiveKit Cloud + LiveKit Agents (Node) |
| Speech to text | Deepgram nova-3, streaming |
| Text to speech | Deepgram Aura-2 (in-app), ElevenLabs Turbo v2.5 (phone) |
| Telephony | Twilio Media Streams |
| API | Fastify 4, Server-Sent Events |
| Data | PostgreSQL 16 + Prisma, Redis 7 + BullMQ |
| App | Expo / React Native |
| Ops | pm2, nginx, Let's Encrypt, Sentry, Prometheus metrics, Bull Board |
| Language | TypeScript (strict), pnpm workspaces + Turborepo |

---

## Getting started

Requirements: Node.js 20+, pnpm 9+, Docker.

```bash
git clone https://github.com/kharetanishk/xTanBot-ai.git
cd xTanBot-ai
pnpm install
cp .env.example .env      # see "Environment variables" below
pnpm docker:up            # Postgres + Redis
pnpm db:migrate
pnpm build
pnpm dev                  # api, worker and voice agent
pnpm mobile:web           # the app, in another terminal
```

### LLM credentials
- **Gemini on Vertex AI (production):** set `VERTEX_PROJECT` and `GOOGLE_APPLICATION_CREDENTIALS` to a service account key with `roles/aiplatform.user`. The client signs a JWT with the key and caches the access token until a minute before it expires.
- **OpenRouter:** leave `VERTEX_PROJECT` empty and set `OPENROUTER_API_KEY`.

Model names are the same either way (`google/gemini-3.5-flash-lite`), because both providers expose an OpenAI-compatible API.

---

## Deployment

Production runs on one Linux VM: Postgres and Redis in Docker (bound to localhost), the API, worker and voice agent under pm2, and the web app as static files behind nginx with Let's Encrypt TLS. Every deploy runs the same script:

```bash
bash infrastructure/deploy/deploy.sh
```

It pulls, installs with a frozen lockfile, generates the Prisma client, builds, applies migrations, exports the web app, restarts the three processes and waits for `/health` to report the API, database and Redis as healthy.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/users` | Register, returns a JWT |
| GET | `/users/me` | Current user |
| POST | `/conversations/message` | Send a chat message; the reply streams back as Server-Sent Events |
| POST | `/voice/session` | LiveKit room and token for in-app voice |
| POST / GET | `/calls`, `/calls/:id` | Place and list calls |
| CRUD | `/meetings`, `/meetings/upcoming` | Meetings |
| CRUD | `/contacts` (`?q=` search) | Contacts |
| GET / POST | `/alarms` | Wake-up call alarms |
| GET | `/health` | API, database and Redis health |
| GET | `/metrics` | Prometheus metrics |
| POST / WS | `/twilio/voice`, `/twilio/status`, `/twilio/stream` | Twilio webhooks and media stream |

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL`, `REDIS_URL` | yes | | Postgres and Redis |
| `JWT_SECRET` | yes | | At least 32 characters |
| `VERTEX_PROJECT` | one LLM option | | Google Cloud project for Gemini on Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | with Vertex | | Service account key file |
| `OPENROUTER_API_KEY` | other LLM option | | OpenRouter instead of Vertex AI |
| `OPENROUTER_MODEL` | no | `anthropic/claude-sonnet-5.5` | Harder text chat turns (production: `google/gemini-3.5-flash`) |
| `OPENROUTER_FAST_MODEL` | no | `anthropic/claude-haiku-4.5` | Quick turns, phone calls (production: `google/gemini-3.5-flash-lite`) |
| `OPENROUTER_VOICE_MODEL` | no | `openai/gpt-4o-mini` | In-app voice (production: `google/gemini-3.5-flash-lite`) |
| `DEEPGRAM_API_KEY` | yes | | Speech to text everywhere, and the in-app voice |
| `DEEPGRAM_TTS_MODEL` | no | `aura-2-thalia-en` | In-app voice, any Deepgram Aura-2 voice |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | for voice | | LiveKit Cloud project |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | yes | | Phone-call voice |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | yes | | Telephony |
| `PHONE_CALLS_ENABLED` | no | `false` | Real outbound calls |
| `SERPER_API_KEY`, `MSG91_AUTH_KEY` | no | | Web search, WhatsApp |
| `SENTRY_DSN` | no | | Error monitoring |
| `RATE_LIMIT_CALLS_PER_HOUR`, `RATE_LIMIT_AI_RPM` | no | `20`, `60` | Abuse limits |
| `VOICE_SESSION_MAX_DURATION_S` | no | `1800` | Longest voice session |

`packages/config` validates all of these with Zod at startup and refuses to start with a clear message if anything is missing.

---

## License

MIT
