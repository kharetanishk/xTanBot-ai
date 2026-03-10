export async function checkRateLimit(
  _key: string,
  _limit: number,
  _windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  return { allowed: true, remaining: _limit };
}
