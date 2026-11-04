import type { AiProvider } from './ai-provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';

let cached: AiProvider | null = null;

/** Returns the configured AI provider. AI is opt-in via environment variables. */
export const getAiProvider = (): AiProvider => {
  if (!cached) cached = new OpenAICompatibleProvider();
  return cached;
};

export const isAiConfigured = (): boolean => getAiProvider().isConfigured();

export type { AiProvider } from './ai-provider';
export { parseJsonObject, cosineSimilarity } from './ai-provider';
