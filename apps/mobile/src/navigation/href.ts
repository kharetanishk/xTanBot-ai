import type { Href } from "expo-router";

/** Typed routes lag file moves; assert until `expo start` regenerates link types. */
export function hrefDashboard(): Href {
  return "/dashboard" as unknown as Href;
}

export function hrefDashboardCalls(): Href {
  return "/dashboard/calls" as unknown as Href;
}

export function hrefDashboardMeetings(): Href {
  return "/dashboard/meetings" as unknown as Href;
}

export function hrefAbout(): Href {
  return "/about" as unknown as Href;
}
