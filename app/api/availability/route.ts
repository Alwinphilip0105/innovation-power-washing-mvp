import { bootstrap } from "@/lib/bootstrap";
import { getBookingProvider } from "@/lib/booking";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import {
  jsonError,
  jsonOk,
  jsonRateLimited,
  jsonServerError,
  jsonValidationError,
} from "@/lib/http/responses";
import { availabilityQuerySchema } from "@/lib/validation/schemas";
import { getCurrentBusiness, resolveService } from "@/services/business";

/** Public read of real openings. Only ever returns slots that pass every booking rule. */
export async function GET(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "availability"), 60, 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    serviceId: url.searchParams.get("serviceId") ?? undefined,
    serviceSlug: url.searchParams.get("serviceSlug") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    days: url.searchParams.get("days") ?? undefined,
  });

  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const business = await getCurrentBusiness();
    const service = await resolveService(business.id, {
      serviceId: parsed.data.serviceId,
      serviceSlug: parsed.data.serviceSlug,
    });

    if (!service) return jsonError("We do not offer that service.", 404);

    const days = await getBookingProvider().getAvailability({
      business,
      service,
      fromDate: parsed.data.from,
      days: parsed.data.days,
    });

    return jsonOk({
      timezone: business.timezone,
      service: { slug: service.slug, name: service.name, durationMinutes: service.duration_minutes },
      days: days.map((day) => ({
        date: day.date,
        weekday: day.weekday,
        slots: day.slots.map((slot) => ({ start: slot.start, time: slot.time, label: slot.label })),
      })),
    });
  } catch (error) {
    return jsonServerError(error, { event: "availability.read" });
  }
}
