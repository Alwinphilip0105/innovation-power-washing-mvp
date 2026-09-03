import { getStore } from "@/lib/db";
import type { Appointment, Business } from "@/lib/db/types";
import { logger } from "@/lib/logging/logger";
import {
  BookingError,
  checkSlot,
  computeAvailability,
  type AvailabilityDay,
  type BusyInterval,
} from "@/lib/booking/availability";
import type {
  BookingProvider,
  CalendarClient,
  CreateAppointmentInput,
  GetAvailabilityInput,
  RescheduleAppointmentInput,
} from "@/lib/booking/provider";

/** Statuses that occupy a slot on the calendar. */
const BLOCKING_STATUSES = ["requested", "confirmed"] as const;

async function loadBusy(
  businessId: string,
  fromIso: string,
  toIso: string,
  excludeAppointmentId?: string,
): Promise<BusyInterval[]> {
  const appointments = await getStore().listAppointments(businessId, {
    from: fromIso,
    to: toIso,
    status: [...BLOCKING_STATUSES],
  });

  return appointments
    .filter((appointment) => appointment.id !== excludeAppointmentId)
    .map((appointment) => ({ start: appointment.start_time, end: appointment.end_time }));
}

/**
 * The internal calendar is always the source of truth: appointments live in our
 * own tables, conflict checks run against our own rows. An optional
 * `CalendarClient` mirrors each booking out to an external calendar, and a
 * failure there never loses the appointment.
 */
export class InternalBookingProvider implements BookingProvider {
  readonly name: string;

  constructor(private readonly calendar?: CalendarClient) {
    this.name = calendar ? `internal+${calendar.name}` : "internal";
  }

  async getAvailability({
    business,
    service,
    fromDate,
    days = 7,
    now = new Date(),
  }: GetAvailabilityInput): Promise<AvailabilityDay[]> {
    const rangeStart = new Date(now.getTime() - 86_400_000).toISOString();
    const rangeEnd = new Date(now.getTime() + (days + 2) * 86_400_000).toISOString();
    const busy = await loadBusy(business.id, rangeStart, rangeEnd);

    return computeAvailability({
      business,
      durationMinutes: service.duration_minutes,
      fromDate,
      days,
      busy,
      now,
    });
  }

  async createAppointment({
    business,
    service,
    customerId,
    leadId,
    startTime,
    notes,
    source,
    now = new Date(),
  }: CreateAppointmentInput): Promise<Appointment> {
    const start = new Date(startTime);
    const durationMinutes = service.duration_minutes;
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const busy = await loadBusy(
      business.id,
      new Date(start.getTime() - 86_400_000).toISOString(),
      new Date(end.getTime() + 86_400_000).toISOString(),
    );

    const rejection = checkSlot({ business, start, durationMinutes, busy, now });
    if (rejection) throw rejection;

    const appointment = await getStore().createAppointment({
      business_id: business.id,
      customer_id: customerId,
      lead_id: leadId ?? null,
      service_id: service.id,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "requested",
      notes: notes ?? null,
      source,
      external_calendar_id: null,
    });

    const externalId = await this.mirrorCreate(business, appointment, service.name);
    if (externalId) {
      return getStore().updateAppointment(business.id, appointment.id, {
        external_calendar_id: externalId,
      });
    }

    return appointment;
  }

  async cancelAppointment(business: Business, appointmentId: string, reason?: string): Promise<Appointment> {
    const store = getStore();
    const existing = await store.getAppointmentById(business.id, appointmentId);
    if (!existing) throw new BookingError("invalid_time", "That appointment no longer exists.");

    const updated = await store.updateAppointment(business.id, appointmentId, {
      status: "cancelled",
      notes: reason ? `${existing.notes ? `${existing.notes}\n` : ""}Cancelled: ${reason}` : existing.notes,
    });

    if (this.calendar && existing.external_calendar_id) {
      try {
        await this.calendar.cancelEvent({ business, externalId: existing.external_calendar_id });
      } catch (error) {
        logger.error("calendar cancel failed", {
          provider: this.calendar.name,
          businessId: business.id,
          event: "appointment.cancelled",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return updated;
  }

  async rescheduleAppointment({
    business,
    appointmentId,
    startTime,
    now = new Date(),
  }: RescheduleAppointmentInput): Promise<Appointment> {
    const store = getStore();
    const existing = await store.getAppointmentById(business.id, appointmentId);
    if (!existing) throw new BookingError("invalid_time", "That appointment no longer exists.");

    const durationMinutes = Math.round(
      (new Date(existing.end_time).getTime() - new Date(existing.start_time).getTime()) / 60_000,
    );
    const start = new Date(startTime);
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const busy = await loadBusy(
      business.id,
      new Date(start.getTime() - 86_400_000).toISOString(),
      new Date(end.getTime() + 86_400_000).toISOString(),
      appointmentId,
    );

    const rejection = checkSlot({ business, start, durationMinutes, busy, now });
    if (rejection) throw rejection;

    const updated = await store.updateAppointment(business.id, appointmentId, {
      start_time: start.toISOString(),
      end_time: end.toISOString(),
    });

    if (this.calendar && existing.external_calendar_id) {
      try {
        await this.calendar.moveEvent({
          business,
          externalId: existing.external_calendar_id,
          startTime: updated.start_time,
          endTime: updated.end_time,
        });
      } catch (error) {
        logger.error("calendar move failed", {
          provider: this.calendar.name,
          businessId: business.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return updated;
  }

  private async mirrorCreate(
    business: Business,
    appointment: Appointment,
    serviceName: string,
  ): Promise<string | null> {
    if (!this.calendar) return null;

    try {
      const { externalId } = await this.calendar.createEvent({
        business,
        summary: `${serviceName} - ${business.name}`,
        description: appointment.notes ?? "",
        startTime: appointment.start_time,
        endTime: appointment.end_time,
      });
      return externalId;
    } catch (error) {
      // The appointment is already saved locally; a calendar outage must not
      // surface to the customer as a failed booking.
      logger.error("calendar create failed", {
        provider: this.calendar.name,
        businessId: business.id,
        event: "appointment.created",
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
