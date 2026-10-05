export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const API_TIMEOUT_MS = 15000;
export const TOKEN_STORAGE_KEY = "xtanbot_auth_token";
export const QUERY_STALE_TIME = 1000 * 60 * 2;

/** Real phone calls (calls, story calls, alarms, meeting auto-calls). Off while on Twilio's free tier. */
export const PHONE_CALLS_ENABLED = process.env.EXPO_PUBLIC_PHONE_CALLS_ENABLED === "true";
