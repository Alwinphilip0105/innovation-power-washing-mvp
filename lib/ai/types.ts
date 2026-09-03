import type { z } from "zod";

import type { Business, Channel, Conversation, Customer, Service } from "@/lib/db/types";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiToolCall {
  /** Correlates a call with its result across turns. */
  id: string;
  name: string;
  input: unknown;
}

export interface AiToolResult {
  id: string;
  name: string;
  output: unknown;
  ok: boolean;
}

export interface AiTurnRequest {
  systemPrompt: string;
  messages: AiMessage[];
  toolResults: AiToolResult[];
  tools: ToolDefinition[];
  /** Everything a tool needs to run safely. Never sent to the model. */
  context: ToolContext;
}

export interface AiTurnResult {
  /** Text to send the customer. Null while the model is still calling tools. */
  reply: string | null;
  toolCalls: AiToolCall[];
  /** Set when the assistant decided a human needs to take over. */
  escalation?: { reason: string };
}

export interface ToolContext {
  business: Business;
  services: Service[];
  conversation: Conversation;
  customer: Customer | null;
  channel: Channel;
  now: Date;
  requestId: string;
}

/**
 * A tool is the only way the assistant can touch data. Each one owns its input
 * schema, and `execute` runs server-side after the schema has parsed — the
 * model's raw output never reaches the store.
 */
export interface ToolDefinition<TSchema extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  schema: TSchema;
  /** JSON Schema handed to the LLM. */
  jsonSchema: Record<string, unknown>;
  /** True when the tool changes state; used for audit-log emphasis. */
  mutates: boolean;
  execute(input: z.infer<TSchema>, context: ToolContext): Promise<unknown>;
}

export interface AIProvider {
  readonly name: string;
  /** One assistant turn: either a reply, or tool calls to run and feed back. */
  respond(request: AiTurnRequest): Promise<AiTurnResult>;
  classifyIntent(message: string, context: ToolContext): Promise<string>;
  extractLeadData(messages: AiMessage[], context: ToolContext): Promise<ExtractedLeadData>;
  summarizeConversation(messages: AiMessage[], context: ToolContext): Promise<string>;
}

export interface ExtractedLeadData {
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  town: string | null;
  street: string | null;
  zip: string | null;
  serviceSlug: string | null;
  notes: string | null;
}
