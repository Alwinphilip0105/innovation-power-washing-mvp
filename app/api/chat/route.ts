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
import { chatRequestSchema } from "@/lib/validation/schemas";
import { getCurrentBusiness } from "@/services/business";
import { getOrCreateConversation } from "@/services/conversations";

/**
 * Website chat. Same assistant, tools and audit trail as SMS and phone - the
 * only difference is the channel guidance in the prompt.
 */
export async function POST(request: Request) {
  bootstrap();

  const limit = rateLimit(clientKey(request, "chat"), 30, 5 * 60_000);
  if (!limit.allowed) return jsonRateLimited(limit.retryAfterSeconds);

  const body = await readJson(request);
  if (body === null) return jsonError("We could not read that message.", 400);

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) return jsonValidationError(parsed.error);

  try {
    const business = await getCurrentBusiness();
    const store = getStore();

    // A conversation id from the client is only ever used to look up a row
    // scoped to this business; it can never widen access.
    let conversation = parsed.data.conversationId
      ? await store.getConversationById(business.id, parsed.data.conversationId)
      : null;

    if (!conversation) {
      conversation = await getOrCreateConversation(business, {
        channel: "web",
        subject: "Website chat",
      });
    }

    const customer = conversation.customer_id
      ? await store.getCustomerById(business.id, conversation.customer_id)
      : null;

    const result = await runAssistantTurn({
      business,
      conversation,
      customer,
      channel: "web",
      body: parsed.data.message,
    });

    await track(business.id, "chat_message", {
      conversationId: result.conversation.id,
      escalated: result.escalated,
      tools: result.toolsUsed,
    });

    return jsonOk({
      conversationId: result.conversation.id,
      reply: result.reply,
      escalated: result.escalated,
    });
  } catch (error) {
    return jsonServerError(error, { event: "chat.turn" });
  }
}
