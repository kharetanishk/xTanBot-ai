/** IANA zones for alarm + profile pickers */
export const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Singapore",
] as const;

export type TimezoneOption = (typeof TIMEZONE_OPTIONS)[number];
