import { handleLead } from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/http/responses";
import { toResponse } from "@/lib/http/to-response";

/**
 * Public lead capture: website "Get a Free Estimate" form.
 *
 * Untrusted input, so: rate limited by IP here, then honeypot checked and
 * schema validated in the shared handler. Nothing reaches the database that
 * has not been parsed.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "leads"), 6, 10 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that submission.", 400);

  return toResponse(await handleLead(body));
}
