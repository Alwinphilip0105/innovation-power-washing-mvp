import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import type { CalendarClient } from "@/lib/booking/provider";

/**
 * Development calendar. Records what would have been sent and hands back a
 * deterministic-looking external id so the rest of the flow is exercised.
 */
export class MockCalendarClient implements CalendarClient {
  readonly name = "mock-calendar";
  private counter = 0;

  async createEvent(input: {
    summary: string;
    startTime: string;
    endTime: string;
  }): Promise<{ externalId: string | null }> {
    this.counter += 1;
    const externalId = `mock-cal-${this.counter}`;
    logger.info("calendar event created", {
      provider: this.name,
      event: "calendar.create",
      externalId,
      summary: input.summary,
      startTime: input.startTime,
      endTime: input.endTime,
    });
    return { externalId };
  }

  async cancelEvent(input: { externalId: string }): Promise<void> {
    logger.info("calendar event cancelled", {
      provider: this.name,
      event: "calendar.cancel",
      externalId: input.externalId,
    });
  }

  async moveEvent(input: { externalId: string; startTime: string; endTime: string }): Promise<void> {
    logger.info("calendar event moved", {
      provider: this.name,
      event: "calendar.move",
      externalId: input.externalId,
      startTime: input.startTime,
    });
  }
}

/**
 * Vendor adapters. Each one is a declared seat in the architecture: selecting
 * it via `BOOKING_PROVIDER` routes every calendar mirror through that vendor's
 * client while the internal calendar stays the source of truth.
 *
 * The HTTP bodies are not implemented here because this build ships without
 * vendor credentials and untested integration code is worse than an explicit
 * failure. Each adapter fails loudly at call time with the exact next step, so
 * a misconfigured deploy can never silently drop appointments.
 */
abstract class UnconfiguredCalendarClient implements CalendarClient {
  abstract readonly name: string;
  protected abstract readonly setupHint: string;

  private fail(): never {
    throw new Error(
      `${this.name} calendar sync is selected but not implemented in this build. ${this.setupHint} ` +
        "Until then, set BOOKING_PROVIDER=internal to keep bookings on the internal calendar.",
    );
  }

  async createEvent(): Promise<{ externalId: string | null }> {
    this.fail();
  }
  async cancelEvent(): Promise<void> {
    this.fail();
  }
  async moveEvent(): Promise<void> {
    this.fail();
  }
}

export class GoogleCalendarClient extends UnconfiguredCalendarClient {
  readonly name = "google-calendar";
  protected readonly setupHint =
    "Implement it against the Google Calendar API v3 events endpoints (insert / patch / delete) using a service account with domain-wide delegation.";
}

export class CalComCalendarClient extends UnconfiguredCalendarClient {
  readonly name = "cal.com";
  protected readonly setupHint =
    "Implement it against the Cal.com v2 bookings API using BOOKING_PROVIDER_API_KEY.";
}

export class CalendlyCalendarClient extends UnconfiguredCalendarClient {
  readonly name = "calendly";
  protected readonly setupHint =
    "Implement it against the Calendly scheduled_events API using a personal access token in BOOKING_PROVIDER_API_KEY.";
}

export function createCalendarClient(): CalendarClient | undefined {
  switch (env.BOOKING_PROVIDER ?? "internal") {
    case "google":
      return new GoogleCalendarClient();
    case "calcom":
      return new CalComCalendarClient();
    case "calendly":
      return new CalendlyCalendarClient();
    case "internal":
    default:
      // In development the mock client keeps the mirror path warm so the code
      // that writes `external_calendar_id` is actually exercised.
      return env.NODE_ENV === "production" ? undefined : new MockCalendarClient();
  }
}
