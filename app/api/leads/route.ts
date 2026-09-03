import { logger } from "@/lib/logging/logger";
import { bootstrap } from "@/lib/bootstrap";
import { track } from "@/lib/analytics";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import {
  jsonCreated,
  jsonError,
  jsonRateLimited,
  jsonServerError,
  jsonValidationError,
  readJson,
} from "@/lib/http/responses";
import { leadFormSchema } from "@/lib/validation/schemas";
import { getCurrentBusiness } from "@/services/business";
import { captureWebsiteLead } from "@/services/leads";

/**
 * Public lead capture: website "Get a Free Estimate" form.
 *
 * Untrusted input, so: rate limited by IP, honeypot checked, schema validated,
 * and nothing reaches the database that has not been parsed.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "leads"), 6, 10 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that submission.", 400);

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  // Honeypot: a filled field means a bot. Answer 201 so it learns nothing.
  if (parsed.data.company) {
    logger.warn("lead honeypot triggered", { event: "lead.rejected" });
    return jsonCreated({ leadId: null, serviceName: null });
  }

  try {
    const business = await getCurrentBusiness();
    const result = await captureWebsiteLead(business, parsed.data);

    await track(business.id, "lead_submitted", {
      source: "website",
      service: result.service?.slug ?? parsed.data.serviceSlug,
      deduplicated: result.deduplicated,
    });

    return jsonCreated({
      leadId: result.lead.id,
      serviceName: result.service?.name ?? null,
    });
  } catch (error) {
    return jsonServerError(error, { event: "lead.create" });
  }
}
