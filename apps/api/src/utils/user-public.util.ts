/** Strip secret fields before sending user JSON to clients. */
export function toPublicUser<T extends { passwordHash: string | null }>(user: T) {
  const { passwordHash: _p, ...rest } = user;
  return rest;
}
