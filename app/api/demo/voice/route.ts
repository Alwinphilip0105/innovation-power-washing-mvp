import { bootstrap } from "@/lib/bootstrap";
import { runAssistantTurn } from "@/lib/ai/engine";
import { track } from "@/lib/analytics";
import { getStore } from "@/lib/db";
import { clientKey, rateLimit } from "@/lib/http/rate-limit";
import {
  jsonError,
  jsonOk,
  jsonRateLimited,
  jsonServerError,
  jsonValidationError,
  readJson,
} from "@/lib/http/responses";
import { voiceDemoSchema } from "@/lib/validation/schemas";
import { getCurrentBusiness } from "@/services/business";
import { appendMessage, getOrCreateConversation } from "@/services/conversations";
import {
  endDemoCall,
  linkDemoCallToConversation,
  startDemoCall,
  voiceGreeting,
} from "@/services/voice-demo";

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

  const parsed = voiceDemoSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);
  const input = parsed.data;

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    // A conversation id from the client only ever looks up a row scoped to this
    // business, so it can never widen access.
    const conversation = input.conversationId
      ? await store.getConversationById(business.id, input.conversationId)
      : null;

    if (input.action === "end") {
      const customer = conversation?.customer_id
        ? await store.getCustomerById(business.id, conversation.customer_id)
        : null;

      const result = await endDemoCall({
        business,
        callId: input.callId,
        conversation,
        customer,
        durationSeconds: input.durationSeconds,
      });

      return jsonOk({
        callId: result.call.id,
        summary: result.summary,
        outcome: result.outcome,
        durationSeconds: result.call.duration,
      });
    }

    let active = conversation;

    if (!active) {
      await startDemoCall({ business, callId: input.callId });
      active = await getOrCreateConversation(business, {
        channel: "phone",
        subject: "Voice demo call",
      });

      // The browser has already spoken the greeting. Recording it keeps the
      // transcript honest and stops the assistant greeting the caller twice.
      await appendMessage({
        conversationId: active.id,
        direction: "outbound",
        sender: "ai",
        body: voiceGreeting(business),
      });

      await track(business.id, "call_received", { direction: "inbound", channel: "phone", demo: true });
    }

    const customer = active.customer_id
      ? await store.getCustomerById(business.id, active.customer_id)
      : null;

    const result = await runAssistantTurn({
      business,
      conversation: active,
      customer,
      channel: "phone",
      body: input.message,
    });

    // The caller only becomes identifiable partway through the call, once the
    // assistant has taken a name and number.
    await linkDemoCallToConversation(business, input.callId, result.conversation);

    return jsonOk({
      conversationId: result.conversation.id,
      reply: result.reply,
      escalated: result.escalated,
      tools: result.toolsUsed,
    });
  } catch (error) {
    return jsonServerError(error, { event: "voice.demo" });
  }
}
