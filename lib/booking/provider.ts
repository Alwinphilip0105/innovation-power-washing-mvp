import type { Appointment, Business, Service } from "@/lib/db/types";
import type { AvailabilityDay } from "@/lib/booking/availability";
import type { LeadSource } from "@/lib/db/types";

export interface GetAvailabilityInput {
  business: Business;
  service: Service;
  fromDate?: string;
  days?: number;
  now?: Date;
}

export interface CreateAppointmentInput {
  business: Business;
  service: Service;
  customerId: string;
  leadId?: string | null;
  /** UTC ISO instant. */
  startTime: string;
  notes?: string | null;
  source: LeadSource;
  now?: Date;
}

export interface RescheduleAppointmentInput {
  business: Business;
  appointmentId: string;
  startTime: string;
  now?: Date;
}

/**
 * Calendar-agnostic booking surface. Business logic depends only on this;
 * swapping Google Calendar / Cal.com / Calendly in is a provider change, not an
 * application change.
 */
export interface BookingProvider {
  readonly name: string;
  getAvailability(input: GetAvailabilityInput): Promise<AvailabilityDay[]>;
  createAppointment(input: CreateAppointmentInput): Promise<Appointment>;
  cancelAppointment(business: Business, appointmentId: string, reason?: string): Promise<Appointment>;
  rescheduleAppointment(input: RescheduleAppointmentInput): Promise<Appointment>;
}

/**
 * The narrow slice of an external calendar the app actually needs. Keeping it
 * this small is what makes the vendor adapters interchangeable.
 */
export interface CalendarClient {
  readonly name: string;
  createEvent(input: {
    business: Business;
    summary: string;
    description: string;
    startTime: string;
    endTime: string;
  }): Promise<{ externalId: string | null }>;
  cancelEvent(input: { business: Business; externalId: string }): Promise<void>;
  moveEvent(input: {
    business: Business;
    externalId: string;
    startTime: string;
    endTime: string;
  }): Promise<void>;
}
