import { handleChat } from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/http/responses";
import { toResponse } from "@/lib/http/to-response";

/**
 * Website chat. The work is in `lib/api/handlers`, shared with the browser-only
 * static build; this adds the things only a server can do - rate limiting by
 * client address, and the HTTP envelope.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "chat"), 30, 5 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that message.", 400);

  return toResponse(await handleChat(body));
}
