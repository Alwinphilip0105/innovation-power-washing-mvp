/**
 * Timezone-aware helpers built on `Intl` — no date library, no ambient
 * dependency on the server's local timezone.
 *
 * Convention used everywhere in the app:
 *   - Instants are stored and passed around as UTC ISO strings.
 *   - Business hours / availability are expressed in the business's IANA zone.
 */

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: Weekday;
}

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    partsFormatterCache.set(timeZone, formatter);
  }
  return formatter;
}

export function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(date);
  const lookup: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") lookup[part.type] = part.value;
  }

  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day),
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
    weekday: lookup.weekday.toLowerCase() as Weekday,
  };
}

/** Offset of `timeZone` at the given instant, in milliseconds (east of UTC positive). */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // Strip sub-second noise so the comparison is exact.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/**
 * Wall-clock time in `timeZone` -> the UTC instant. Refined twice so DST
 * transitions resolve correctly.
 */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const naive = Date.UTC(year, month - 1, day, hour, minute, 0);
  let timestamp = naive - zoneOffsetMs(new Date(naive), timeZone);
  timestamp = naive - zoneOffsetMs(new Date(timestamp), timeZone);
  return new Date(timestamp);
}

/** `"2026-04-18"` + `"14:30"` in `timeZone` -> UTC instant. */
export function parseZonedDateTime(dateIso: string, time: string, timeZone: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid zoned date/time: "${dateIso}" "${time}"`);
  }
  return zonedTimeToUtc(
    Number(dateMatch[1]),
    Number(dateMatch[2]),
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
    timeZone,
  );
}

/** UTC instant -> `"YYYY-MM-DD"` as seen in `timeZone`. */
export function toZonedDateIso(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function weekdayIn(date: Date, timeZone: string): Weekday {
  return getZonedParts(date, timeZone).weekday;
}

/** Minutes since midnight, in `timeZone`. */
export function minutesOfDay(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
}

export function parseTimeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) throw new Error(`Invalid time "${time}", expected HH:MM`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time "${time}"`);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDaysIso(dateIso: string, days: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return next.toISOString().slice(0, 10);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Half-open interval overlap: `[aStart, aEnd)` vs `[bStart, bEnd)`. */
export function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime();
}

const displayCache = new Map<string, Intl.DateTimeFormat>();

export function formatInZone(
  date: Date | string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";

  const key = `${timeZone}|${JSON.stringify(options)}`;
  let formatter = displayCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, ...options });
    displayCache.set(key, formatter);
  }
  return formatter.format(value);
}

export function relativeTime(date: Date | string, now: Date = new Date()): string {
  const value = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return "—";

  const diffSeconds = Math.round((value.getTime() - now.getTime()) / 1000);
  const absolute = Math.abs(diffSeconds);
  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

  if (absolute < 60) return formatter.format(Math.round(diffSeconds), "second");
  if (absolute < 3600) return formatter.format(Math.round(diffSeconds / 60), "minute");
  if (absolute < 86_400) return formatter.format(Math.round(diffSeconds / 3600), "hour");
  if (absolute < 2_592_000) return formatter.format(Math.round(diffSeconds / 86_400), "day");
  return formatter.format(Math.round(diffSeconds / 2_592_000), "month");
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}
