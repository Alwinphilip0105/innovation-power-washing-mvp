import { bootstrap } from "@/lib/bootstrap";
import { BookingError } from "@/lib/booking/availability";
import { track } from "@/lib/analytics";
import { getStore } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import {
  jsonCreated,
  jsonError,
  jsonRateLimited,
  jsonServerError,
  jsonValidationError,
  readJson,
} from "@/lib/http/responses";
import { formatInZone } from "@/lib/utils/datetime";
import { createAppointmentSchema } from "@/lib/validation/schemas";
import { bookAppointment, describeBookingError } from "@/services/appointments";
import { getCurrentBusiness, resolveService } from "@/services/business";
import { captureLead } from "@/services/leads";

/**
 * Public booking. The provider re-checks every rule server-side, so a stale
 * slot from a client that has been sitting open is rejected rather than
 * double-booked.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "appointments"), 8, 10 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that request.", 400);

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);
  const input = parsed.data;

  try {
    const business = await getCurrentBusiness();
    const service = await resolveService(business.id, {
      serviceId: input.serviceId,
      serviceSlug: input.serviceSlug,
    });
    if (!service) return jsonError("We do not offer that service.", 404);

    const store = getStore();

    // Resolve the customer: either an existing id, or capture a lead which
    // de-duplicates on phone and attaches the address.
    let customer = input.customerId ? await store.getCustomerById(business.id, input.customerId) : null;
    let leadId = input.leadId ?? null;

    if (!customer && input.customer) {
      const captured = await captureLead({
        business,
        source: input.source,
        identity: {
          firstName: input.customer.firstName,
          lastName: input.customer.lastName ?? null,
          phone: input.customer.phone,
          email: input.customer.email ?? null,
        },
        address: input.address,
        serviceId: service.id,
        notes: input.notes ?? null,
        status: "qualified",
      });
      customer = captured.customer;
      leadId = leadId ?? captured.lead.id;
    }

    if (!customer) return jsonError("We need your contact details to book that.", 400);

    const appointment = await bookAppointment({
      business,
      service,
      customer,
      leadId,
      startTime: input.startTime,
      notes: input.notes ?? null,
      source: input.source,
    });

    await track(business.id, "appointment_created", { source: input.source, service: service.slug });

    return jsonCreated({
      appointmentId: appointment.id,
      status: appointment.status,
      when: formatInZone(new Date(appointment.start_time), business.timezone, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  } catch (error) {
    // A rejected booking is a normal outcome, not a server fault.
    if (error instanceof BookingError) {
      return jsonError(describeBookingError(error), 409, { code: error.code });
    }
    return jsonServerError(error, { event: "appointment.create" });
  }
}
