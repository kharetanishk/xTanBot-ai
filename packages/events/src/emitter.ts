import { publishEvent } from "./bus";
import type {
  CallStartedEvent,
  CallCompletedEvent,
  CallFailedEvent,
} from "./events/call.events";
import type {
  MeetingScheduledEvent,
  MeetingCancelledEvent,
} from "./events/meeting.events";
import type {
  SessionCreatedEvent,
  SessionExpiredEvent,
} from "./events/session.events";
import type {
  AgentRespondedEvent,
  AgentToolCalledEvent,
} from "./events/agent.events";

// Type-safe emit helpers — one per event type
export const emit = {
  callStarted: (e: Omit<CallStartedEvent, "type">) =>
    publishEvent({ ...e, type: "call.started" }),

  callCompleted: (e: Omit<CallCompletedEvent, "type">) =>
    publishEvent({ ...e, type: "call.completed" }),

  callFailed: (e: Omit<CallFailedEvent, "type">) =>
    publishEvent({ ...e, type: "call.failed" }),

  meetingScheduled: (e: Omit<MeetingScheduledEvent, "type">) =>
    publishEvent({ ...e, type: "meeting.scheduled" }),

  meetingCancelled: (e: Omit<MeetingCancelledEvent, "type">) =>
    publishEvent({ ...e, type: "meeting.cancelled" }),

  sessionCreated: (e: Omit<SessionCreatedEvent, "type">) =>
    publishEvent({ ...e, type: "session.created" }),

  sessionExpired: (e: Omit<SessionExpiredEvent, "type">) =>
    publishEvent({ ...e, type: "session.expired" }),

  agentResponded: (e: Omit<AgentRespondedEvent, "type">) =>
    publishEvent({ ...e, type: "agent.responded" }),

  agentToolCalled: (e: Omit<AgentToolCalledEvent, "type">) =>
    publishEvent({ ...e, type: "agent.tool_called" }),
};
