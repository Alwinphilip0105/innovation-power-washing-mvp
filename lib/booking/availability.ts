import type { Business } from "@/lib/db/types";
import {
  addDaysIso,
  intervalsOverlap,
  minutesToTime,
  parseTimeToMinutes,
  parseZonedDateTime,
  toZonedDateIso,
  weekdayIn,
  type Weekday,
} from "@/lib/utils/datetime";

export interface BusyInterval {
  start: string;
  end: string;
}

export interface AvailabilitySlot {
  /** UTC ISO instant. */
  start: string;
  end: string;
  /** `YYYY-MM-DD` in the business timezone. */
  date: string;
  /** `HH:MM` in the business timezone. */
  time: string;
  label: string;
}

export interface AvailabilityDay {
  date: string;
  weekday: Weekday;
  slots: AvailabilitySlot[];
}

export type BookingRejectionCode =
  | "invalid_duration"
  | "invalid_time"
  | "outside_business_hours"
  | "too_soon"
  | "too_far_out"
  | "slot_unavailable";

export class BookingError extends Error {
  constructor(
    readonly code: BookingRejectionCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

const MAX_DURATION_MINUTES = 12 * 60;

function windowsFor(business: Business, weekday: Weekday) {
  return business.business_hours[weekday] ?? [];
}

/**
 * True when `[start, end)` sits entirely inside one of the business's opening
 * windows for that day, in the business's own timezone.
 */
export function isWithinBusinessHours(business: Business, start: Date, end: Date): boolean {
  const tz = business.timezone;
  const dateIso = toZonedDateIso(start, tz);
  const weekday = weekdayIn(start, tz);

  for (const window of windowsFor(business, weekday)) {
    const open = parseZonedDateTime(dateIso, window.open, tz);
    const close = parseZonedDateTime(dateIso, window.close, tz);
    if (start.getTime() >= open.getTime() && end.getTime() <= close.getTime()) return true;
  }
  return false;
}

/**
 * How many existing jobs collide with `[start, end)` once travel/cleanup buffer
 * is applied to the existing appointments.
 */
export function countConflicts(
  busy: BusyInterval[],
  start: Date,
  end: Date,
  bufferMinutes: number,
): number {
  const bufferMs = bufferMinutes * 60_000;
  let count = 0;

  for (const interval of busy) {
    const busyStart = new Date(new Date(interval.start).getTime() - bufferMs);
    const busyEnd = new Date(new Date(interval.end).getTime() + bufferMs);
    if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime())) continue;
    if (intervalsOverlap(start, end, busyStart, busyEnd)) count += 1;
  }

  return count;
}

export interface SlotCheckInput {
  business: Business;
  start: Date;
  durationMinutes: number;
  busy: BusyInterval[];
  now?: Date;
}

/**
 * The single gate every booking path goes through — website, dashboard, AI
 * tool call and webhook alike. Returns a `BookingError` describing the first
 * rule that fails, or null when the slot is bookable.
 */
export function checkSlot({
  business,
  start,
  durationMinutes,
  busy,
  now = new Date(),
}: SlotCheckInput): BookingError | null {
  const rules = business.settings.bookingRules;

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0 || durationMinutes > MAX_DURATION_MINUTES) {
    return new BookingError("invalid_duration", "That job length is not valid.");
  }
  if (Number.isNaN(start.getTime())) {
    return new BookingError("invalid_time", "That date and time is not valid.");
  }

  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const earliest = now.getTime() + rules.minNoticeMinutes * 60_000;
  if (start.getTime() < earliest) {
    return new BookingError("too_soon", "We need a little more notice than that for a new appointment.");
  }

  const latest = now.getTime() + rules.maxAdvanceDays * 86_400_000;
  if (start.getTime() > latest) {
    return new BookingError("too_far_out", "That is further out than we currently schedule.");
  }

  if (!isWithinBusinessHours(business, start, end)) {
    return new BookingError("outside_business_hours", "That time falls outside our working hours.");
  }

  if (countConflicts(busy, start, end, rules.bufferMinutes) >= rules.maxConcurrentAppointments) {
    return new BookingError("slot_unavailable", "That time has already been taken.");
  }

  return null;
}

export interface ComputeAvailabilityInput {
  business: Business;
  durationMinutes: number;
  /** `YYYY-MM-DD` in business time. Defaults to today. */
  fromDate?: string;
  days?: number;
  busy: BusyInterval[];
  now?: Date;
}

/**
 * Walks the business-hours grid and returns every slot that survives
 * `checkSlot`. Days with no openings are still returned (with an empty list) so
 * the UI can show "no availability" rather than silently skipping a date.
 */
export function computeAvailability({
  business,
  durationMinutes,
  fromDate,
  days = 7,
  busy,
  now = new Date(),
}: ComputeAvailabilityInput): AvailabilityDay[] {
  const tz = business.timezone;
  const rules = business.settings.bookingRules;
  const startDate = fromDate ?? toZonedDateIso(now, tz);

  const timeLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });

  const result: AvailabilityDay[] = [];

  for (let dayOffset = 0; dayOffset < days; dayOffset += 1) {
    const dateIso = addDaysIso(startDate, dayOffset);
    // Midday probe: safe from DST edge cases when naming the weekday.
    const weekday = weekdayIn(parseZonedDateTime(dateIso, "12:00", tz), tz);
    const slots: AvailabilitySlot[] = [];

    for (const window of windowsFor(business, weekday)) {
      const openMinutes = parseTimeToMinutes(window.open);
      const closeMinutes = parseTimeToMinutes(window.close);

      for (
        let minute = openMinutes;
        minute + durationMinutes <= closeMinutes;
        minute += rules.slotIntervalMinutes
      ) {
        const time = minutesToTime(minute);
        const start = parseZonedDateTime(dateIso, time, tz);
        if (checkSlot({ business, start, durationMinutes, busy, now })) continue;

        slots.push({
          start: start.toISOString(),
          end: new Date(start.getTime() + durationMinutes * 60_000).toISOString(),
          date: dateIso,
          time,
          label: timeLabel.format(start),
        });
      }
    }

    result.push({ date: dateIso, weekday, slots });
  }

  return result;
}
