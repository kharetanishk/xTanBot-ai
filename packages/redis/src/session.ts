export async function getSession(_sessionId: string): Promise<Record<string, unknown> | null> {
  return null;
}

export async function setSession(
  _sessionId: string,
  _data: Record<string, unknown>,
  _ttlSeconds: number,
): Promise<void> {}

export async function deleteSession(_sessionId: string): Promise<void> {}
