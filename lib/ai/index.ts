import { env } from "@/lib/env";
import { logger } from "@/lib/logging/logger";
import { AnthropicAIProvider } from "@/lib/ai/anthropic-provider";
import { MockAIProvider } from "@/lib/ai/mock-provider";
import type { AIProvider } from "@/lib/ai/types";

const globalRef = globalThis as unknown as { __ipwAiProvider?: AIProvider };

function create(): AIProvider {
  if (env.AI_PROVIDER === "anthropic" && env.LLM_API_KEY) {
    logger.info("ai provider initialised", { provider: "anthropic" });
    return new AnthropicAIProvider(env.LLM_API_KEY, env.LLM_MODEL);
  }

  if (env.AI_PROVIDER && env.AI_PROVIDER !== "mock" && !env.LLM_API_KEY) {
    logger.warn("AI_PROVIDER is set but LLM_API_KEY is missing - falling back to the mock assistant", {
      provider: env.AI_PROVIDER,
    });
  }

  logger.info("ai provider initialised", { provider: "mock" });
  return new MockAIProvider();
}

export function getAIProvider(): AIProvider {
  if (!globalRef.__ipwAiProvider) {
    globalRef.__ipwAiProvider = create();
  }
  return globalRef.__ipwAiProvider;
}

export function setAIProvider(provider: AIProvider) {
  globalRef.__ipwAiProvider = provider;
}

export * from "@/lib/ai/types";
