# LEARNING.md — Voice AI: xTanBot vs Gideon vs Wisper

Read in full: xTanBot-ai (this repo), `~/voice-ai-refs/gideon-ai-voice`, `~/voice-ai-refs/my-wisper-emotion`.

## 1. Pipeline in 4 steps (xTanBot)

| Step | What happens | Folder |
|---|---|---|
| **Hear** | Twilio WS → μ-law 8kHz → Deepgram streaming STT | `apps/api/src/twilio-media-stream.ts`, `packages/voice-pipeline/src/twilio/`, `packages/voice-pipeline/src/transcription/stt-client.ts` |
| **Think** | Transcript queued → BullMQ → Claude agent + tools | `packages/voice-pipeline/src/pipeline.ts` (enqueue), `apps/worker/src/workers/agent.worker.ts`, `packages/ai-core/src/agent.ts`, `tool-router.ts` |
| **Speak** | Full LLM text → ElevenLabs streamed TTS → μ-law back over Twilio WS | `packages/voice-pipeline/src/elevenlabs/tts-client.ts`, `pipeline.ts` (`handleTTSResponse`) |
| **Speed** | Barge-in, silence watchdog, TTS abort, latency histograms | `pipeline.ts` (barge-in/silence), `agent.worker.ts` (latency), `packages/observability/src/metrics.ts` |

## 2. Comparison table

yes = fully implemented, partial = exists but limited/local-only/stubbed, no = not found.

| Topic | xTanBot | Gideon | Wisper |
|---|---|---|---|
| Audio format | **yes** — μ-law 8kHz (`voice-pipeline/src/transcription/stt-client.ts:76-78`, `elevenlabs/tts-client.ts:59-61`) | no — left to LiveKit defaults | **yes** — 16kHz PCM16 (`engine/pipeline.ts:171`, `engine/recorder/recorder.ts:63`) |
| VAD | partial — custom energy heuristic (`voice-pipeline/src/pipeline.ts:62-79`) | **yes** — Silero VAD (`apps/agent/src/entry.ts:19,31`) | **yes** — Silero VAD ONNX (`engine/vad/silero.ts:39-217`) |
| Streaming STT | **yes** — Deepgram Nova-2 WS (`stt-client.ts:72-82`) | **yes** — Deepgram Nova-3 (`entry.ts:32`) | **yes** — local whisper.cpp + LocalAgreement (`engine/streamer/streamer.ts`, `local-agreement.ts`) |
| LLM tool calling | **yes** — Anthropic tool_use (`ai-core/src/agent.ts:463-472`) | **yes** — LiveKit `tool()` + zod (`tools/ToolRegistry.ts:63-95`) | no |
| State machine | partial — status field, no FSM class | **yes** — `CallPhase` enum + transition table (`packages/shared/src/phases.ts:9-39`) | no |
| Multi-agent handoff | no | **yes** — Triage→Intake→Qualification→Scheduling (`orchestrator/CallOrchestrator.ts:110-125`) | no |
| Streaming TTS | **yes** — ElevenLabs stream (`tts-client.ts:53-77`) | **yes** — Deepgram TTS (`entry.ts:33`) | no |
| LLM-to-TTS streaming | no — waits for full text (`agent.ts:463`) | no — internal to LiveKit SDK, not in repo | no |
| Barge-in | **yes** — 750ms grace + 4-loud-chunk gate (`pipeline.ts:590-622`) | **yes** — `minWords:2` + false-interruption recovery (`entry.ts:46-52,93-113`) | no |
| Turn detection | partial — Deepgram endpointing + 350ms debounce (`pipeline.ts:194-245`) | **yes** — `eou_metrics` (`entry.ts:131-137`) | partial — VAD speech-segment boundaries only |
| Latency measurement | partial — queue-wait/agent-response histograms, no TTFB (`agent.worker.ts:53-62`) | **yes** — TTFT, TTS TTFB, end-of-utterance delay (`entry.ts:115-138`) | partial — VAD-only debug timing |
| Error handling / fallbacks | **yes** — per-provider retry + spoken fallback phrases (`stt-client.ts:146-191`, `agent.ts:42-133`, `agent.worker.ts:68-81`) | **yes** — unified error event, recoverable flag (`entry.ts:141-153`) | partial — local fallback to heuristic/passthrough only |
| Evals/tests | no — 1 schema unit test only | no — zero test files | no — 1 native-addon smoke test |
| Idempotent tools | no | **yes** — idempotency key on scheduling (`AppointmentService.ts:34-52`) | no |
| Event streaming to UI | no — mobile uses REST only | **yes** — SSE via Redis pub/sub (`EventStreamService.ts:16-48`) | no (single desktop process, IPC only) |
| WebRTC | no — Twilio PSTN only | **yes** — via LiveKit (`LiveKitTokenService.ts:16-33`) | no |
| Local/offline STT | no | no — cloud Deepgram only | **yes** — whisper.cpp native addon, core feature |
| Emotion detection | no | no | **yes** — ONNX classifier, core feature (`engine/emotion.ts:111-223`) |
| Cost tracking | **yes** — per-turn USD + session cap (`agent.worker.ts:89-90,172-198,313-336`) | partial — token counts captured, no $ calc | no |
| PII redaction | partial — credential fields only, not transcripts (`packages/logger/src/index.ts:20-33`) | partial — same, log-secret redaction only (`packages/shared/src/logger.ts:44,51`) | no |
| Provider fallback | no — same-provider retry only | no — single provider each | no — offline, no providers |
| Observability | **yes** — Prometheus + pino, tracing is a no-op stub (`observability/src/metrics.ts`, `tracing.ts:1-3`) | partial — structured logs + metrics events, no tracing | partial — console logging only |

## 3. Gap backlog (xTanBot is no/partial, a reference is yes) — by importance

1. **LLM-to-TTS sentence streaming** — biggest latency lever, neither reference has it either → differentiator if we build it first.
2. **Turn detection** — upgrade custom VAD heuristic → real VAD (Silero, like both refs) for barge-in/silence accuracy.
3. **Multi-agent handoff + state machine** — Gideon's phase-based FSM + specialized agents; xTanBot has one flat agent.
4. **Latency measurement (TTFB)** — add time-to-first-audio-byte metric like Gideon's `tts_metrics`.
5. **Idempotent tools** — add idempotency key to `make-call`/`schedule-meeting` tools like Gideon's appointment service.
6. **Event streaming to UI** — SSE/WS push to mobile app, like Gideon's Redis→SSE pipe.
7. **Evals/tests** — near-zero coverage across all three repos; xTanBot should lead here.
8. **WebRTC** — Gideon has it via LiveKit; add browser channel alongside Twilio PSTN.
9. **Local/offline STT + emotion detection** — Wisper's specialties; optional differentiators (Day 7 stretch).
10. **PII redaction of transcripts** — none of the three repos redact caller PII in logs; real gap for enterprise readiness.
11. **Provider fallback** — none of the three repos have it; genuine differentiator.

## 4. Upgrade backlog (beyond the references)

| Upgrade | Worth it? | Effort |
|---|---|---|
| End-to-end latency metric (stop talking → first audio out) | worth-it | small |
| LLM-to-TTS sentence streaming | worth-it | medium |
| Semantic turn detection (replace energy heuristic) | worth-it | medium |
| Eval harness with scripted/simulated callers | worth-it | medium |
| Provider fallback (STT/TTS/LLM) | worth-it | medium |
| PII redaction in logs/transcripts | worth-it | small |
| Cost per call | skip — already built (`agent.worker.ts:89-90`) | — |
| Browser WebRTC channel next to phone channel | worth-it | large |
| Live call console UI | worth-it | medium |
| Human handoff / call transfer | worth-it | medium |
| Voicemail detection and DTMF | skip — low ROI for current use case | small |
| Prompt-injection tests | worth-it — sanitiser already exists (`agent.worker.ts:96-123`), just needs tests | small |
| Load test for concurrent calls | worth-it | medium |
| Call recording consent handling | worth-it — compliance requirement once recording is added | small |

## 5. 7-day plan

- **Day 1 — Hearing**: LEARN audio format/VAD/streaming STT (all three repos) → BUILD: replace energy-heuristic VAD with Silero → DEMO: call in, show VAD trims vs old heuristic.
- **Day 2 — Thinking**: LEARN LLM/tool calling/state machine/multi-agent (Gideon deep dive) → BUILD: add `CallPhase` state machine (adapt Gideon's transition table) → DEMO: log phase transitions on a real call.
- **Day 3 — Speaking**: LEARN streaming TTS/LLM-to-TTS streaming → BUILD: sentence-chunked LLM→TTS streaming → DEMO: measure time-to-first-audio before/after.
- **Day 4 — Speed + interruptions**: LEARN latency/barge-in/turn detection → BUILD: add TTFB metric + tighten barge-in using new VAD → DEMO: interrupt bot mid-sentence, show clear+abort in logs.
- **Day 5 — Reliability**: LEARN errors/fallbacks/idempotent tools/observability → BUILD: idempotency keys on tools + provider fallback for STT → DEMO: kill Deepgram, show fallback engages.
- **Day 6 — Quality + channels**: LEARN evals/WebRTC/live UI → BUILD: eval harness (5 scripted calls) + SSE event stream to mobile → DEMO: run eval suite, show pass/fail; open live UI during a call.
- **Day 7 — Enterprise**: LEARN PII/security/cost/scale → BUILD: PII redaction on transcripts + prompt-injection tests + docs → DEMO: final end-to-end recorded call, show redacted logs.

**Overload check**: Day 3 and Day 6 are each carrying 2 medium/large builds. If tight, move "live UI" from Day 6 to Day 7, and treat local STT/emotion tagging (optional) as a Day 8+ stretch, not inside Day 7.

## 6. Definition of Done per day

- Day 1: Silero VAD replaces heuristic in `pipeline.ts`; barge-in test call recorded; note explains why energy-variance missed quiet speech.
- Day 2: `CallPhase` enum + `isTransitionAllowed` enforced in `pipeline.ts`/worker; phase log on one full call; note explains phase vs flat-agent tradeoff.
- Day 3: sentence-boundary streaming from `agent.ts` into `tts-client.ts`; TTFB metric before/after in `metrics.ts`; note explains chunking strategy.
- Day 4: barge-in latency metric added; interrupt-mid-sentence call recorded with logs; note explains grace-window tuning.
- Day 5: idempotency key added to `make-call.tool.ts`; STT provider fallback test (kill Deepgram mid-call); note explains retry-vs-fallback distinction.
- Day 6: `evals/` folder with 5 scripted call scripts + pass/fail runner; SSE endpoint streaming `CallEvent`s to mobile; note explains eval scoring.
- Day 7: transcript PII redaction in `packages/logger`; prompt-injection test suite around `sanitiseTranscript`; final demo video; note explains redaction scope/limits.

## 7. Scorecard

| Topic | Before | After |
|---|---|---|
| Audio format | yes | |
| VAD | partial | |
| Streaming STT | yes | |
| LLM tool calling | yes | |
| State machine | partial | |
| Multi-agent handoff | no | |
| Streaming TTS | yes | |
| LLM-to-TTS streaming | no | |
| Barge-in | yes | |
| Turn detection | partial | |
| Latency measurement | partial | |
| Error handling/fallbacks | yes | |
| Evals/tests | no | |
| Idempotent tools | no | |
| Event streaming to UI | no | |
| WebRTC | no | |
| Local/offline STT | no | |
| Emotion detection | no | |
| Cost tracking | yes | |
| PII redaction | partial | |
| Provider fallback | no | |
| Observability | yes | |

## 8. Progress log

(empty — append 3 lines after each lesson/build: what we covered, my check answer, what's next)
