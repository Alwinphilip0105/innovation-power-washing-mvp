import { getAIProvider } from "@/lib/ai";
import { buildSystemPrompt } from "@/lib/ai/prompt";
import { executeTool, TOOLS } from "@/lib/ai/tools";
import { getStore } from "@/lib/db";
import { logger } from "@/lib/logging/logger";
import { newId } from "@/lib/utils/id";
import { getActiveServices } from "@/services/business";
import { appendMessage } from "@/services/conversations";
import type { AiMessage, AiToolResult, ToolContext } from "@/lib/ai/types";
import type { Business, Channel, Conversation, Customer, Message } from "@/lib/db/types";

/** Safety valve: a runaway tool loop costs money and blocks the request. */
const MAX_TOOL_ITERATIONS = 5;

export interface AssistantTurnInput {
  business: Business;
  conversation: Conversation;
  customer: Customer | null;
  channel: Channel;
  /** The customer's message. Already validated and sanitized upstream. */
  body: string;
  providerMessageId?: string | null;
  now?: Date;
}

export interface AssistantTurnResult {
  conversation: Conversation;
  inbound: Message;
  outbound: Message;
  reply: string;
  escalated: boolean;
  toolsUsed: string[];
}

/** Conversation history in the shape a provider consumes. System notes are internal. */
export function toAiMessages(messages: Message[]): AiMessage[] {
  return messages
    .filter((message) => message.sender !== "system")
    .map((message) => ({
      role: message.direction === "inbound" ? ("user" as const) : ("assistant" as const),
      content: message.body,
    }));
}

/**
 * One assistant turn, shared by web chat, SMS and the voice webhook.
 *
 * Persist inbound -> run the model/tool loop -> persist outbound. There is one
 * AI implementation and one tool pipeline; a channel only decides the prompt's
 * channel guidance and how the reply is delivered.
 */
export async function runAssistantTurn(input: AssistantTurnInput): Promise<AssistantTurnResult> {
  const store = getStore();
  const requestId = newId();
  const now = input.now ?? new Date();
  const log = logger.child({
    requestId,
    businessId: input.business.id,
    event: "ai.turn",
    channel: input.channel,
  });

  const inbound = await appendMessage({
    conversationId: input.conversation.id,
    direction: "inbound",
    sender: "customer",
    body: input.body,
    providerMessageId: input.providerMessageId ?? null,
  });

  const services = await getActiveServices(input.business.id);
  const history = toAiMessages(await store.listMessages(input.conversation.id));

  let conversation = input.conversation;
  let customer = input.customer;

  const context: ToolContext = {
    business: input.business,
    services,
    conversation,
    customer,
    channel: input.channel,
    now,
    requestId,
  };

  const systemPrompt = buildSystemPrompt({
    business: input.business,
    services,
    channel: input.channel,
    customerName: customer ? customer.first_name : null,
  });

  const provider = getAIProvider();
  const toolResults: AiToolResult[] = [];
  const toolsUsed: string[] = [];

  let reply: string | null = null;
  let escalated = false;

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const turn = await provider.respond({
      systemPrompt,
      messages: history,
      toolResults,
      tools: TOOLS,
      context,
    });

    if (turn.escalation) escalated = true;

    if (turn.toolCalls.length === 0) {
      reply = turn.reply;
      break;
    }

    for (const call of turn.toolCalls) {
      const execution = await executeTool(call.name, call.input, context);
      toolsUsed.push(call.name);
      toolResults.push({ id: call.id, name: call.name, output: execution.output, ok: execution.ok });

      // A newly created customer must be attached to the conversation so the
      // CRM timeline and any follow-up automation resolve correctly.
      if (call.name === "create_customer" && execution.ok) {
        const created = execution.output as { customer_id?: string };
        if (created.customer_id && !conversation.customer_id) {
          customer = await store.getCustomerById(input.business.id, created.customer_id);
          conversation = await store.updateConversation(input.business.id, conversation.id, {
            customer_id: created.customer_id,
            lead_id: conversation.lead_id,
          });
          context.customer = customer;
          context.conversation = conversation;
        }
      }

      if (call.name === "create_lead" && execution.ok) {
        const created = execution.output as { lead_id?: string };
        if (created.lead_id && !conversation.lead_id) {
          conversation = await store.updateConversation(input.business.id, conversation.id, {
            lead_id: created.lead_id,
          });
          context.conversation = conversation;
        }
      }

      if (call.name === "notify_owner" && execution.ok) escalated = true;
    }
  }

  if (!reply) {
    log.warn("assistant produced no reply", { success: false, iterations: MAX_TOOL_ITERATIONS });
    reply =
      "I'm having trouble getting that sorted from here. Let me have someone from the office call you back.";
    escalated = true;
  }

  const outbound = await appendMessage({
    conversationId: conversation.id,
    direction: "outbound",
    sender: "ai",
    body: reply,
  });

  const refreshed = await store.getConversationById(input.business.id, conversation.id);
  if (refreshed) conversation = refreshed;

  log.info("assistant turn complete", {
    success: true,
    conversationId: conversation.id,
    tools: toolsUsed.join(",") || "none",
    escalated,
  });

  return { conversation, inbound, outbound, reply, escalated, toolsUsed };
}
