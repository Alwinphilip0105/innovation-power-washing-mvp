import { handleAppointment } from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/http/responses";
import { toResponse } from "@/lib/http/to-response";

/**
 * Public booking. The shared handler re-checks every rule, so a stale slot from
 * a client that has been sitting open is rejected rather than double-booked.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "appointments"), 8, 10 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that request.", 400);

  return toResponse(await handleAppointment(body));
}
