import { bootstrap } from "@/lib/bootstrap";
import { runAssistantTurn } from "@/lib/ai/engine";
import { getStore } from "@/lib/db";
import { jsonError, jsonOk, jsonServerError, jsonValidationError } from "@/lib/http/responses";
import { logger } from "@/lib/logging/logger";
import { getSmsProvider } from "@/lib/sms/providers";
import { smsWebhookSchema } from "@/lib/validation/schemas";
import { getCurrentBusiness } from "@/services/business";
import { appendMessage, getOrCreateConversation } from "@/services/conversations";
import { findOrCreateCustomer } from "@/services/customers";

/**
 * Inbound SMS.
 *
 *   provider -> signature check -> idempotency -> conversation -> AI -> reply
 *
 * Idempotency is enforced on the provider's event id: a retried delivery is
 * acknowledged with 200 and dropped, so a customer never gets two replies to
 * the same text.
 */
export async function POST(request: Request) {
  bootstrap();

  const raw = await request.text();
  const provider = getSmsProvider();

  if (!provider.verifyWebhook(raw, request.headers)) {
    logger.warn("sms webhook signature rejected", { provider: provider.name, event: "sms.webhook" });
    return jsonError("Invalid signature.", 401);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return jsonError("Malformed webhook body.", 400);
  }

  const parsed = smsWebhookSchema.safeParse(payload);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    const isNew = await store.recordWebhookEvent(provider.name, parsed.data.eventId, business.id);
    if (!isNew) {
      logger.info("duplicate sms webhook ignored", {
        businessId: business.id,
        provider: provider.name,
        event: "sms.webhook",
      });
      return jsonOk({ duplicate: true });
    }

    const { customer } = await findOrCreateCustomer(business.id, {
      firstName: "Texter",
      phone: parsed.data.from,
    });

    const conversation = await getOrCreateConversation(business, {
      customerId: customer.id,
      channel: "sms",
      subject: "SMS conversation",
    });

    // Empty bodies (delivery receipts and the like) are recorded, not answered.
    if (!parsed.data.body.trim()) {
      await appendMessage({
        conversationId: conversation.id,
        direction: "inbound",
        sender: "customer",
        body: "(empty message)",
        providerMessageId: parsed.data.messageId ?? null,
      });
      return jsonOk({ replied: false });
    }

    const result = await runAssistantTurn({
      business,
      conversation,
      customer,
      channel: "sms",
      body: parsed.data.body,
      providerMessageId: parsed.data.messageId ?? null,
    });

    // Deliver the reply. A send failure is recorded, never retried blindly.
    try {
      const sent = await provider.send({
        to: parsed.data.from,
        from: business.settings.notifications.ownerPhone,
        body: result.reply,
      });
      logger.info("sms reply delivered", {
        businessId: business.id,
        provider: provider.name,
        event: "sms.reply",
        status: sent.status,
        success: true,
      });
    } catch (error) {
      logger.error("sms reply failed to send", {
        businessId: business.id,
        provider: provider.name,
        event: "sms.reply",
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return jsonOk({ replied: true, conversationId: result.conversation.id });
  } catch (error) {
    return jsonServerError(error, { event: "sms.webhook" });
  }
}
