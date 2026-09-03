import { getStore } from "@/lib/db";
import { emit } from "@/lib/events/bus";
import type {
  Business,
  Channel,
  Conversation,
  Customer,
  Message,
  MessageDirection,
  MessageSender,
  MessageStatus,
} from "@/lib/db/types";

export async function getOrCreateConversation(
  business: Business,
  options: { customerId?: string | null; leadId?: string | null; channel: Channel; subject?: string },
): Promise<Conversation> {
  const store = getStore();

  if (options.customerId) {
    const existing = await store.findOpenConversation(business.id, options.customerId, options.channel);
    if (existing) return existing;
  }

  return store.createConversation({
    business_id: business.id,
    customer_id: options.customerId ?? null,
    lead_id: options.leadId ?? null,
    channel: options.channel,
    status: "open",
    subject: options.subject ?? null,
  });
}

export interface AppendMessageInput {
  conversationId: string;
  direction: MessageDirection;
  sender: MessageSender;
  body: string;
  providerMessageId?: string | null;
  status?: MessageStatus;
}

export async function appendMessage(input: AppendMessageInput): Promise<Message> {
  return getStore().createMessage({
    conversation_id: input.conversationId,
    direction: input.direction,
    sender: input.sender,
    body: input.body,
    provider_message_id: input.providerMessageId ?? null,
    status: input.status ?? (input.direction === "inbound" ? "received" : "sent"),
  });
}

/**
 * Marks a conversation as needing a person and notifies the owner. Called by
 * the AI escalation tool and by the missed-call automation.
 */
export async function escalateConversation(
  business: Business,
  conversation: Conversation,
  reason: string,
  detail?: string,
): Promise<Conversation> {
  const store = getStore();
  const updated =
    conversation.status === "escalated"
      ? conversation
      : await store.updateConversation(business.id, conversation.id, { status: "escalated" });

  const customer = updated.customer_id
    ? await store.getCustomerById(business.id, updated.customer_id)
    : null;

  await emit("escalation.required", {
    business,
    conversation: updated,
    customer,
    reason,
    detail,
  });

  return updated;
}

export interface ConversationThread {
  conversation: Conversation;
  customer: Customer | null;
  messages: Message[];
}

export async function getConversationThread(
  business: Business,
  conversationId: string,
): Promise<ConversationThread | null> {
  const store = getStore();
  const conversation = await store.getConversationById(business.id, conversationId);
  if (!conversation) return null;

  const [customer, messages] = await Promise.all([
    conversation.customer_id
      ? store.getCustomerById(business.id, conversation.customer_id)
      : Promise.resolve(null),
    store.listMessages(conversation.id),
  ]);

  return { conversation, customer, messages };
}

export async function listConversationSummaries(business: Business, limit = 50) {
  const store = getStore();
  const conversations = await store.listConversations(business.id, { limit });

  return Promise.all(
    conversations.map(async (conversation) => {
      const [customer, messages] = await Promise.all([
        conversation.customer_id
          ? store.getCustomerById(business.id, conversation.customer_id)
          : Promise.resolve(null),
        store.listMessages(conversation.id),
      ]);

      return {
        conversation,
        customer,
        messageCount: messages.length,
        lastMessage: messages.at(-1) ?? null,
      };
    }),
  );
}
