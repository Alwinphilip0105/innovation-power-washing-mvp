import { handleAvailability } from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { jsonRateLimited } from "@/lib/http/responses";
import { toResponse } from "@/lib/http/to-response";

/** Public read of real openings. Only ever returns slots that pass every booking rule. */
export async function GET(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "availability"), 60, 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const url = new URL(request.url);

  return toResponse(
    await handleAvailability({
      serviceId: url.searchParams.get("serviceId"),
      serviceSlug: url.searchParams.get("serviceSlug"),
      from: url.searchParams.get("from"),
      days: url.searchParams.get("days"),
    }),
  );
}
