import { scheduleMeetingTool } from "./schedule-meeting.tool";
import { lookupContactTool } from "./lookup-contact.tool";
import { makeCallTool } from "./make-call.tool";
import { getCurrentTimeTool } from "./get-current-time.tool";
import { setAlarmTool } from "./set-alarm.tool";
import { webSearchTool } from "./web-search.tool";
import { webFetchTool } from "./web-fetch.tool";
import { sendWhatsappTool } from "./send-whatsapp.tool";
import { getLocationTool } from "./get-location.tool";
import { storyCallTool } from "./story-call.tool";
import type { ToolDefinition } from "../types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const allTools: ToolDefinition<any, any>[] = [
  scheduleMeetingTool,
  lookupContactTool,
  makeCallTool,
  storyCallTool,
  getCurrentTimeTool,
  setAlarmTool,
  webSearchTool,
  webFetchTool,
  sendWhatsappTool,
  getLocationTool,
];

export {
  scheduleMeetingTool,
  lookupContactTool,
  makeCallTool,
  storyCallTool,
  getCurrentTimeTool,
  setAlarmTool,
  webSearchTool,
  webFetchTool,
  sendWhatsappTool,
  getLocationTool,
};
