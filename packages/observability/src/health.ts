export async function healthCheck(): Promise<{ status: "ok" | "degraded" | "down" }> {
  return { status: "ok" };
}
