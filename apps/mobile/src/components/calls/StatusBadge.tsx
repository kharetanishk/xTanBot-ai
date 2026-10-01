import type { Call } from "../../types/api.types";
import { Badge } from "../ui";
import type { Tone } from "../../theme";

export const CALL_STATUS_TONE: Record<string, Tone> = {
  "in-progress": "success",
  ringing: "accent",
  initiated: "accent",
  completed: "neutral",
  failed: "danger",
  busy: "danger",
  "no-answer": "danger",
};

export default function StatusBadge({ status }: { status: Call["status"] }) {
  return <Badge label={status.replace("-", " ")} tone={CALL_STATUS_TONE[status] ?? "neutral"} />;
}
