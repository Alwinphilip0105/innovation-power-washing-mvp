import Anthropic from "@anthropic-ai/sdk";

import { logger } from "@/lib/logging/logger";
import { deriveState } from "@/lib/ai/extract";
import type {
  AIProvider,
  AiMessage,
  AiTurnRequest,
  AiTurnResult,
  ExtractedLeadData,
  ToolContext,
  ToolDefinition,
} from "@/lib/ai/types";

/**
 * Claude-backed assistant. Selected with `AI_PROVIDER=anthropic` + `LLM_API_KEY`.
 *
 * The engine owns the outer loop (it executes tools and calls `respond` again),
 * so this provider keeps the Anthropic-format message list for the turn in a
 * short-lived cache keyed by request id - the API requires each `tool_use`
 * block to be echoed back alongside its `tool_result`.
 */

interface TurnState {
  messages: Anthropic.Beta.BetaMessageParam[];
  /** How many of the engine's accumulated tool results we have already sent. */
  submitted: number;
}

const DEFAULT_MODEL = "claude-opus-5";
const MAX_TOKENS = 16_000;

export class AnthropicAIProvider implements AIProvider {
  readonly name = "anthropic";

  private readonly client: Anthropic;
  private readonly model: string;
  private readonly turns = new Map<string, TurnState>();

  constructor(apiKey: string, model: string = DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  private toolParams(tools: ToolDefinition[]): Anthropic.Beta.BetaToolUnion[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.jsonSchema as Anthropic.Beta.BetaTool["input_schema"],
    }));
  }

  async respond(request: AiTurnRequest): Promise<AiTurnResult> {
    const key = request.context.requestId;
    let state = this.turns.get(key);

    if (!state) {
      state = {
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        submitted: 0,
      };
      this.turns.set(key, state);
    }

    // Feed back any tool results the engine produced since the last call.
    const pending = request.toolResults.slice(state.submitted);
    if (pending.length > 0) {
      state.messages.push({
        role: "user",
        content: pending.map((result) => ({
          type: "tool_result" as const,
          tool_use_id: result.id,
          content: JSON.stringify(result.output),
          is_error: !result.ok,
        })),
      });
      state.submitted = request.toolResults.length;
    }

    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: request.systemPrompt,
        // Thinking stays on at low effort: it keeps latency down while avoiding
        // the disabled-thinking failure mode where a tool call is emitted as
        // plain text and silently never runs.
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        tools: this.toolParams(request.tools),
        messages: state.messages,
      });
    } catch (error) {
      this.turns.delete(key);
      throw error;
    }

    if (response.stop_reason === "refusal") {
      this.turns.delete(key);
      logger.warn("assistant declined the request", {
        businessId: request.context.business.id,
        requestId: key,
        provider: this.name,
      });
      return {
        reply:
          "I'm not able to help with that one. If you'd like, I can have someone from the office call you back.",
        toolCalls: [],
        escalation: { reason: "model_refusal" },
      };
    }

    const toolCalls = response.content
      .filter((block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name, input: block.input }));

    const text = response.content
      .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (toolCalls.length > 0) {
      state.messages.push({ role: "assistant", content: response.content });
      return { reply: null, toolCalls };
    }

    this.turns.delete(key);
    return {
      reply: text || "I'm not sure I caught that - could you say it another way?",
      toolCalls: [],
    };
  }

  /** Single-shot classification; no tools, minimal output. */
  async classifyIntent(message: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 64,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system:
        "Classify the customer message into exactly one label: booking, pricing, service_question, complaint, human_handoff, general. Reply with the label only.",
      messages: [{ role: "user", content: message }],
    });

    const text = response.content.find((block) => block.type === "text");
    const label = text && text.type === "text" ? text.text.trim().toLowerCase() : "general";
    const allowed = ["booking", "pricing", "service_question", "complaint", "human_handoff", "general"];
    return allowed.includes(label) ? label : "general";
  }

  /**
   * Deterministic extraction is used even with a live model: lead fields feed
   * straight into validated writes, and a regex that returns null is safer than
   * a model that hallucinates a phone number.
   */
  async extractLeadData(messages: AiMessage[], context: ToolContext): Promise<ExtractedLeadData> {
    const state = deriveState(messages, context.business, context.services);
    return {
      firstName: state.firstName,
      lastName: state.lastName,
      phone: state.phone,
      email: state.email,
      town: state.town,
      street: state.street,
      zip: state.zip,
      serviceSlug: state.serviceSlug,
      notes: state.notes,
    };
  }

  async summarizeConversation(messages: AiMessage[]): Promise<string> {
    const transcript = messages
      .map((message) => `${message.role === "user" ? "Customer" : "Assistant"}: ${message.content}`)
      .join("\n");

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 300,
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
      system:
        "Summarize this conversation for the business owner in two or three sentences. State only what was said. Do not invent details.",
      messages: [{ role: "user", content: transcript }],
    });

    const text = response.content.find((block) => block.type === "text");
    return text && text.type === "text" ? text.text.trim() : "";
  }
}
