import { scheduleMeetingTool } from "./schedule-meeting.tool";
import { lookupContactTool } from "./lookup-contact.tool";
import { makeCallTool } from "./make-call.tool";
import { getCurrentTimeTool } from "./get-current-time.tool";
import type { ToolDefinition } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allTools: ToolDefinition<any, any>[] = [
  scheduleMeetingTool,
  lookupContactTool,
  makeCallTool,
  getCurrentTimeTool,
];

export {
  scheduleMeetingTool,
  lookupContactTool,
  makeCallTool,
  getCurrentTimeTool,
};
