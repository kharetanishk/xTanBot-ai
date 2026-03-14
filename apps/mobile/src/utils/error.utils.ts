import { getApiError } from "@api/client";

export function parseError(error: unknown): string {
  return getApiError(error);
}
