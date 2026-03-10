import { z } from "zod";
import { ttsQueue, TTS_JOB_NAME } from "../queues/tts.queue";
import { createLogger } from "@xtanbot/logger";

const logger = createLogger("TtsJob");

export const TtsJobSchema = z.object({
  sessionId: z.string().uuid(),
  callSid: z.string().min(1),
  text: z.string().min(1).max(5000),
  voiceId: z.string().optional(),
});

export type TtsJob = z.infer<typeof TtsJobSchema>;

export async function enqueueTtsJob(data: TtsJob): Promise<void> {
  const validated = TtsJobSchema.parse(data);
  await ttsQueue.add(TTS_JOB_NAME, validated);
  logger.info({ sessionId: data.sessionId }, "TTS job enqueued");
}
