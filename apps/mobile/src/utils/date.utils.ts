const APP_TIMEZONE = "Asia/Kolkata";

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** YYYY-MM-DDTHH:mm in IST for datetime-local style inputs. */
export function toISTInputFormat(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function isUpcoming(iso: string): boolean {
  return new Date(iso) > new Date();
}

/** Calendar date YYYY-MM-DD in `timeZone`, shifted by whole days from now (approx). */
export function zonedYmdFromOffsetDays(
  timeZone: string,
  offsetDays: number,
): string {
  const shifted = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(shifted);
}

function parsePartInt(s: string | undefined): number {
  if (s == null || s === "") return NaN;
  return parseInt(s, 10);
}

/**
 * Wall clock (y-m-d, hour, minute) in IANA `timeZone` → UTC instant as ISO string (Z).
 * No extra deps; converges for typical zones / DST.
 */
export function zonedWallTimeToUtcIso(
  ymd: string,
  hour: number,
  minute: number,
  timeZone: string,
): string {
  const parts = ymd.split("-").map((x) => parseInt(x, 10));
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (
    parts.length !== 3 ||
    Number.isNaN(y) ||
    Number.isNaN(mo) ||
    Number.isNaN(d)
  ) {
    throw new Error("Invalid date");
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const targetUtc = Date.UTC(y, mo - 1, d, hour, minute, 0);
  let guess = targetUtc;
  for (let i = 0; i < 24; i++) {
    const fp = formatter.formatToParts(new Date(guess));
    const get = (t: Intl.DateTimeFormatPartTypes) =>
      fp.find((p) => p.type === t)?.value;
    const py = parsePartInt(get("year"));
    const pmo = parsePartInt(get("month"));
    const pd = parsePartInt(get("day"));
    let ph = parsePartInt(get("hour"));
    const pmin = parsePartInt(get("minute"));
    const psec = parsePartInt(get("second"));
    if (ph === 24) ph = 0;
    if (
      py === y &&
      pmo === mo &&
      pd === d &&
      ph === hour &&
      pmin === minute
    ) {
      return new Date(guess).toISOString();
    }
    const asUtc = Date.UTC(py, pmo - 1, pd, ph, pmin, Number.isNaN(psec) ? 0 : psec);
    guess += targetUtc - asUtc;
  }
  return new Date(guess).toISOString();
}

export function formatDateTimeInTimeZone(iso: string, timeZone: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatClockNowInTimeZone(timeZone: string): string {
  return new Date().toLocaleString("en-IN", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}
