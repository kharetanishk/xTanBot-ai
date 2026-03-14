export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export const API_TIMEOUT_MS = 15000;
export const TOKEN_STORAGE_KEY = "xtanbot_auth_token";
export const QUERY_STALE_TIME = 1000 * 60 * 2;
