import { getBookingProvider } from "@/lib/booking";
import { BookingError } from "@/lib/booking/availability";
import { getStore } from "@/lib/db";
import { emit } from "@/lib/events/bus";
import { logger } from "@/lib/logging/logger";
import type { Appointment, AppointmentStatus, Business, Customer, LeadSource, Service } from "@/lib/db/types";

export interface BookAppointmentInput {
  business: Business;
  service: Service;
  customer: Customer;
  leadId?: string | null;
  startTime: string;
  notes?: string | null;
  source: LeadSource;
  now?: Date;
}

/**
 * Books an appointment through the booking provider and settles the CRM side
 * effects: the lead moves to `booked` and the owner is notified.
 *
 * Rejections come back as `BookingError` with a machine-readable code so the
 * web form, the dashboard and the AI can each phrase the refusal correctly
 * instead of guessing.
 */
export async function bookAppointment(input: BookAppointmentInput): Promise<Appointment> {
  const appointment = await getBookingProvider().createAppointment({
    business: input.business,
    service: input.service,
    customerId: input.customer.id,
    leadId: input.leadId ?? null,
    startTime: input.startTime,
    notes: input.notes ?? null,
    source: input.source,
    now: input.now,
  });

  if (input.leadId) {
    const store = getStore();
    const lead = await store.getLeadById(input.business.id, input.leadId);
    if (lead && lead.status !== "completed" && lead.status !== "booked") {
      await store.updateLead(input.business.id, input.leadId, { status: "booked" });
    }
  }

  logger.info("appointment booked", {
    businessId: input.business.id,
    event: "appointment.created",
    appointmentId: appointment.id,
    provider: input.source,
  });

  await emit("appointment.created", {
    business: input.business,
    appointment,
    customer: input.customer,
  });

  return appointment;
}

export async function cancelAppointment(
  business: Business,
  appointmentId: string,
  reason?: string,
): Promise<Appointment> {
  const appointment = await getBookingProvider().cancelAppointment(business, appointmentId, reason);
  const customer = await getStore().getCustomerById(business.id, appointment.customer_id);

  if (customer) {
    await emit("appointment.cancelled", { business, appointment, customer });
  }

  return appointment;
}

export async function setAppointmentStatus(
  business: Business,
  appointmentId: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  if (status === "cancelled") return cancelAppointment(business, appointmentId);

  const appointment = await getStore().updateAppointment(business.id, appointmentId, { status });

  if (status === "completed" && appointment.lead_id) {
    const store = getStore();
    const lead = await store.getLeadById(business.id, appointment.lead_id);
    if (lead && lead.status !== "completed") {
      await store.updateLead(business.id, appointment.lead_id, { status: "completed" });
    }
  }

  return appointment;
}

/** Human-facing message for a booking rejection. Never leaks internals. */
export function describeBookingError(error: unknown): string {
  if (error instanceof BookingError) return error.message;
  return "We could not complete that booking. Please try another time or call the office.";
}

export interface AppointmentWithContext {
  appointment: Appointment;
  customer: Customer | null;
  service: Service | null;
}

/** Joins appointments to their customer and service for list rendering. */
export async function withContext(
  business: Business,
  appointments: Appointment[],
): Promise<AppointmentWithContext[]> {
  const store = getStore();

  const customerIds = [...new Set(appointments.map((a) => a.customer_id))];
  const serviceIds = [...new Set(appointments.map((a) => a.service_id).filter(Boolean))] as string[];

  const [customers, services] = await Promise.all([
    Promise.all(customerIds.map((id) => store.getCustomerById(business.id, id))),
    Promise.all(serviceIds.map((id) => store.getServiceById(business.id, id))),
  ]);

  const customerMap = new Map(customers.filter(Boolean).map((c) => [c!.id, c!]));
  const serviceMap = new Map(services.filter(Boolean).map((s) => [s!.id, s!]));

  return appointments.map((appointment) => ({
    appointment,
    customer: customerMap.get(appointment.customer_id) ?? null,
    service: appointment.service_id ? (serviceMap.get(appointment.service_id) ?? null) : null,
  }));
}
