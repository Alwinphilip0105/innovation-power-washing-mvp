import { bootstrap } from "@/lib/bootstrap";
import { runAssistantTurn } from "@/lib/ai/engine";
import { getStore } from "@/lib/db";
import { jsonError, jsonOk, jsonServerError, jsonValidationError } from "@/lib/http/responses";
import { logger } from "@/lib/logging/logger";
import { track } from "@/lib/analytics";
import { getVoiceProvider } from "@/lib/voice/provider";
import { voiceWebhookSchema } from "@/lib/validation/schemas";
import { getCurrentBusiness } from "@/services/business";
import { recordVoiceEvent } from "@/services/calls";
import { getOrCreateConversation } from "@/services/conversations";

/**
 * Inbound telephony webhook.
 *
 * The vendor payload is normalized before anything downstream sees it, so the
 * CRM, missed-call automation and AI agent never depend on which provider is
 * configured. Missed calls fire `call.missed`, which triggers the follow-up SMS.
 *
 * A completed call with a transcript is replayed through the same assistant
 * used by chat and SMS, so the call summary and any captured lead land in the
 * one conversation timeline.
 */
export async function POST(request: Request) {
  bootstrap();

  const raw = await request.text();
  const provider = getVoiceProvider();

  if (!provider.verifyWebhook(raw, request.headers)) {
    logger.warn("voice webhook signature rejected", { provider: provider.name, event: "voice.webhook" });
    return jsonError("Invalid signature.", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonError("Malformed webhook body.", 400);
  }

  const parsed = voiceWebhookSchema.safeParse(payload);
  if (!parsed.success) return jsonValidationError(parsed.error);
  const event = parsed.data;

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    const isNew = await store.recordWebhookEvent(provider.name, event.eventId, business.id);
    if (!isNew) {
      logger.info("duplicate voice webhook ignored", {
        businessId: business.id,
        provider: provider.name,
        event: "voice.webhook",
      });
      return jsonOk({ duplicate: true });
    }

    const call = await recordVoiceEvent(business, {
      event: event.event,
      provider: provider.name,
      callId: event.callId,
      from: event.from,
      to: event.to,
      direction: event.direction,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      durationSeconds: event.durationSeconds,
      transcript: event.transcript,
      summary: event.summary,
      outcome: event.outcome,
      recordingUrl: event.recordingUrl,
    });

    await track(business.id, event.event === "call.missed" ? "missed_call" : "call_received", {
      direction: event.direction,
      status: call.status,
    });

    // Completed call with a transcript: hand the caller's words to the same
    // assistant so the enquiry is captured rather than sitting in a transcript.
    if (event.event === "call.completed" && event.transcript && call.customer_id) {
      const customer = await store.getCustomerById(business.id, call.customer_id);
      if (customer) {
        const conversation = await getOrCreateConversation(business, {
          customerId: customer.id,
          leadId: call.lead_id,
          channel: "phone",
          subject: "Phone call",
        });

        await runAssistantTurn({
          business,
          conversation,
          customer,
          channel: "phone",
          body: event.transcript.slice(0, 4000),
        });
      }
    }

    return jsonOk({ callId: call.id, status: call.status });
  } catch (error) {
    return jsonServerError(error, { event: "voice.webhook" });
  }
}
