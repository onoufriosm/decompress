import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import type { LanguageModelV1 } from "ai";

export type AIProvider = "anthropic" | "openai" | "google";

export interface ProviderConfig {
  provider: AIProvider;
  model: string;
}

// Default models for each provider
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-20250514",
  openai: "gpt-4o",
  google: "gemini-1.5-pro",
};

// Cost per query estimate (for query limit calculation)
// Based on ~2500 input tokens + ~500 output tokens per query
export const ESTIMATED_COST_PER_QUERY: Record<AIProvider, number> = {
  anthropic: 0.02, // ~$3/1M input + $15/1M output
  openai: 0.015, // ~$2.50/1M input + $10/1M output
  google: 0.01, // ~$1.25/1M input + $5/1M output
};

// Monthly query limit (based on $4 budget / estimated cost)
export const MONTHLY_QUERY_LIMIT = 200;

export function getModel(config: ProviderConfig): LanguageModelV1 {
  const { provider, model } = config;

  switch (provider) {
    case "anthropic":
      return anthropic(model);
    case "openai":
      return openai(model);
    case "google":
      return google(model);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export function getDefaultConfig(): ProviderConfig {
  // Default to Anthropic Claude
  return {
    provider: "anthropic",
    model: DEFAULT_MODELS.anthropic,
  };
}

// Get provider from environment or use default
export function getProviderFromEnv(): ProviderConfig {
  const provider = (process.env.AI_PROVIDER as AIProvider) || "anthropic";
  const model = process.env.AI_MODEL || DEFAULT_MODELS[provider];

  return { provider, model };
}
