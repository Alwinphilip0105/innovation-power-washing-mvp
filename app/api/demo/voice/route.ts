import { handleVoiceDemo } from "@/lib/api/handlers";
import { bootstrap } from "@/lib/bootstrap";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import { jsonError, jsonRateLimited, readJson } from "@/lib/http/responses";
import { toResponse } from "@/lib/http/to-response";

/**
 * Browser voice demo: one spoken turn, or the end of the call.
 *
 * Speech recognition and speech synthesis happen in the browser; this endpoint
 * only ever sees text. That keeps the server identical to the telephony path -
 * the assistant, the tools and the CRM writes are the production ones, and the
 * microphone is the only part that is a demo.
 */
export async function POST(request: Request) {
  bootstrap();

  // Generous enough for a real conversation, tight enough to stop a public
  // demo page being used as free assistant time.
  const limit = rateLimit(clientKey(request, "voice-demo"), 60, 5 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that request.", 400);

  return toResponse(await handleVoiceDemo(body));
}
