import { Badge } from "../ui";
import type { Tone } from "../../theme";

type MeetingStatus = "scheduled" | "confirmed" | "cancelled" | "completed" | "rescheduled";

const TONE: Record<MeetingStatus, Tone> = {
  scheduled: "accent",
  confirmed: "success",
  cancelled: "danger",
  completed: "neutral",
  rescheduled: "info",
};

export default function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <Badge label={status} tone={TONE[status] ?? "neutral"} />;
}
