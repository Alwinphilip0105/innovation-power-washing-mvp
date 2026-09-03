import { describe, expect, it } from "vitest";

import { innovationPowerWashing } from "@/lib/config/business";
import {
  checkSlot,
  computeAvailability,
  countConflicts,
  isWithinBusinessHours,
} from "@/lib/booking/availability";
import { parseZonedDateTime, toZonedDateIso } from "@/lib/utils/datetime";
import type { Business } from "@/lib/db/types";

const TZ = innovationPowerWashing.timezone;

function businessWith(overrides: Partial<Business["settings"]["bookingRules"]> = {}): Business {
  return {
    ...innovationPowerWashing,
    settings: {
      ...innovationPowerWashing.settings,
      bookingRules: { ...innovationPowerWashing.settings.bookingRules, ...overrides },
    },
  };
}

/** A Monday well clear of any DST transition. */
const MONDAY = "2026-06-08";
const at = (date: string, time: string) => parseZonedDateTime(date, time, TZ);

describe("isWithinBusinessHours", () => {
  const business = businessWith();

  it("accepts a job that fits inside the weekday window", () => {
    expect(isWithinBusinessHours(business, at(MONDAY, "09:00"), at(MONDAY, "12:00"))).toBe(true);
  });

  it("rejects a job that starts before opening", () => {
    expect(isWithinBusinessHours(business, at(MONDAY, "06:00"), at(MONDAY, "09:00"))).toBe(false);
  });

  it("rejects a job that would run past closing", () => {
    expect(isWithinBusinessHours(business, at(MONDAY, "19:00"), at(MONDAY, "22:00"))).toBe(false);
  });

  it("accepts Sunday inside the same 7am–9pm window", () => {
    const sunday = "2026-06-07";
    expect(isWithinBusinessHours(business, at(sunday, "09:00"), at(sunday, "12:00"))).toBe(true);
  });

  it("treats Saturday like every other day", () => {
    const saturday = "2026-06-13";
    expect(isWithinBusinessHours(business, at(saturday, "08:00"), at(saturday, "11:00"))).toBe(true);
    expect(isWithinBusinessHours(business, at(saturday, "12:00"), at(saturday, "15:00"))).toBe(true);
    expect(isWithinBusinessHours(business, at(saturday, "19:00"), at(saturday, "22:00"))).toBe(false);
  });
});

describe("countConflicts", () => {
  const busy = [{ start: at(MONDAY, "09:00").toISOString(), end: at(MONDAY, "12:00").toISOString() }];

  it("counts a direct overlap", () => {
    expect(countConflicts(busy, at(MONDAY, "10:00"), at(MONDAY, "13:00"), 0)).toBe(1);
  });

  it("treats back-to-back jobs as free when there is no buffer", () => {
    expect(countConflicts(busy, at(MONDAY, "12:00"), at(MONDAY, "14:00"), 0)).toBe(0);
  });

  it("counts back-to-back jobs as a conflict once travel buffer is applied", () => {
    expect(countConflicts(busy, at(MONDAY, "12:00"), at(MONDAY, "14:00"), 30)).toBe(1);
  });

  it("ignores intervals that do not touch the window", () => {
    expect(countConflicts(busy, at(MONDAY, "13:00"), at(MONDAY, "15:00"), 30)).toBe(0);
  });

  it("skips malformed intervals instead of throwing", () => {
    expect(countConflicts([{ start: "not-a-date", end: "also-bad" }], at(MONDAY, "09:00"), at(MONDAY, "10:00"), 0)).toBe(0);
  });
});

describe("checkSlot", () => {
  const now = at(MONDAY, "08:00");

  it("accepts a valid, free slot", () => {
    const business = businessWith({ minNoticeMinutes: 0 });
    expect(checkSlot({ business, start: at(MONDAY, "09:00"), durationMinutes: 180, busy: [], now })).toBeNull();
  });

  it("rejects a slot inside the notice window", () => {
    const business = businessWith();
    const error = checkSlot({
      business,
      start: at(MONDAY, "09:00"),
      durationMinutes: 180,
      busy: [],
      now,
    });
    expect(error?.code).toBe("too_soon");
  });

  it("rejects a slot beyond the booking horizon", () => {
    const business = businessWith({ minNoticeMinutes: 0, maxAdvanceDays: 7 });
    const error = checkSlot({
      business,
      start: at("2026-08-10", "09:00"),
      durationMinutes: 180,
      busy: [],
      now,
    });
    expect(error?.code).toBe("too_far_out");
  });

  it("rejects a slot outside business hours", () => {
    const business = businessWith({ minNoticeMinutes: 0 });
    const error = checkSlot({
      business,
      start: at(MONDAY, "21:00"),
      durationMinutes: 60,
      busy: [],
      now,
    });
    expect(error?.code).toBe("outside_business_hours");
  });

  it("rejects a nonsense duration", () => {
    const business = businessWith({ minNoticeMinutes: 0 });
    expect(
      checkSlot({ business, start: at(MONDAY, "09:00"), durationMinutes: 0, busy: [], now })?.code,
    ).toBe("invalid_duration");
    expect(
      checkSlot({ business, start: at(MONDAY, "09:00"), durationMinutes: 60 * 24, busy: [], now })?.code,
    ).toBe("invalid_duration");
  });

  it("allows a second crew but not a third", () => {
    const business = businessWith({ minNoticeMinutes: 0, maxConcurrentAppointments: 2, bufferMinutes: 0 });
    const one = [{ start: at(MONDAY, "09:00").toISOString(), end: at(MONDAY, "12:00").toISOString() }];
    const two = [...one, { start: at(MONDAY, "09:00").toISOString(), end: at(MONDAY, "12:00").toISOString() }];

    expect(checkSlot({ business, start: at(MONDAY, "09:00"), durationMinutes: 120, busy: one, now })).toBeNull();
    expect(
      checkSlot({ business, start: at(MONDAY, "09:00"), durationMinutes: 120, busy: two, now })?.code,
    ).toBe("slot_unavailable");
  });
});

describe("computeAvailability", () => {
  const business = businessWith({ minNoticeMinutes: 0, bufferMinutes: 0, maxConcurrentAppointments: 1 });
  const now = at(MONDAY, "06:00");

  it("only offers slots that finish before closing", () => {
    const [day] = computeAvailability({
      business,
      durationMinutes: 180,
      fromDate: MONDAY,
      days: 1,
      busy: [],
      now,
    });

    expect(day.slots[0].time).toBe("07:00");
    expect(day.slots.at(-1)?.time).toBe("18:00");
    expect(day.slots.map((slot) => slot.time)).toContain("14:00");
  });

  it("returns Sunday with the same openings as other days", () => {
    const days = computeAvailability({
      business,
      durationMinutes: 120,
      fromDate: "2026-06-07",
      days: 2,
      busy: [],
      now: at("2026-06-06", "06:00"),
    });

    expect(days).toHaveLength(2);
    expect(days[0].weekday).toBe("sun");
    expect(days[0].slots.length).toBeGreaterThan(0);
    expect(days[1].slots.length).toBeGreaterThan(0);
  });

  it("hides slots that collide with an existing appointment", () => {
    const busy = [{ start: at(MONDAY, "09:00").toISOString(), end: at(MONDAY, "12:00").toISOString() }];
    const [day] = computeAvailability({
      business,
      durationMinutes: 120,
      fromDate: MONDAY,
      days: 1,
      busy,
      now,
    });

    const times = day.slots.map((slot) => slot.time);
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("10:00");
    expect(times).not.toContain("11:00");
    expect(times).toContain("12:00");
  });

  it("labels every slot in the business timezone", () => {
    const [day] = computeAvailability({
      business,
      durationMinutes: 120,
      fromDate: MONDAY,
      days: 1,
      busy: [],
      now,
    });

    expect(day.slots[0].label).toBe("7:00 AM");
    // The stored instant is 7am Eastern, which is 11:00 UTC in June (EDT).
    expect(day.slots[0].start).toBe("2026-06-08T11:00:00.000Z");
  });

  it("keeps wall-clock hours correct across the spring DST change", () => {
    // 2026-03-08 is the US spring-forward date; the 9th is the Monday after.
    const monday = "2026-03-09";
    const [day] = computeAvailability({
      business,
      durationMinutes: 120,
      fromDate: monday,
      days: 1,
      busy: [],
      now: at("2026-03-09", "05:00"),
    });

    expect(day.slots[0].time).toBe("07:00");
    // 7am EDT = 11:00 UTC. If DST were mishandled this would be 12:00 UTC.
    expect(day.slots[0].start).toBe("2026-03-09T11:00:00.000Z");
    expect(toZonedDateIso(new Date(day.slots[0].start), TZ)).toBe(monday);
  });
});
