import type { AiProvider } from './ai-provider';
import { OpenAICompatibleProvider } from './openai-compatible.provider';
import { Env } from '../../config/env.config';
import AiSettingsModel from '../../models/ai-settings.model';

let cached: AiProvider | null = null;

/** Provider built purely from server env (fallback when no DB settings exist). */
export const buildEnvProvider = (): AiProvider =>
  new OpenAICompatibleProvider({ enabled: Env.AI_ENABLED === 'true' });

/**
 * Resolve the provider: admin DB settings win when present, with any unset field
 * falling back to env. On DB error we degrade to env so the app still boots.
 */
const buildProvider = async (): Promise<AiProvider> => {
  try {
    const db = await AiSettingsModel.getRaw();
    if (db) {
      return new OpenAICompatibleProvider({
        id: db.provider,
        baseUrl: db.baseUrl ?? undefined,
        apiKey: db.apiKey ?? undefined,
        chatModel: db.defaultChatModel ?? undefined,
        visionModel: db.defaultVisionModel ?? undefined,
        embeddingModel: db.defaultEmbeddingModel ?? undefined,
        enabled: db.isEnabled,
      });
    }
  } catch {
    // Table missing / DB unavailable → env fallback.
  }
  return buildEnvProvider();
};

/** Returns the resolved AI provider (DB-over-env), memoized until invalidated. */
export const getAiProvider = async (): Promise<AiProvider> => {
  if (!cached) cached = await buildProvider();
  return cached;
};

/** Clear the memoized provider so the next call re-reads admin settings. */
export const invalidateAiProviderCache = (): void => {
  cached = null;
};

export const isAiConfigured = async (): Promise<boolean> =>
  (await getAiProvider()).isConfigured();

export type { AiProvider } from './ai-provider';
export {
  parseJsonObject,
  cosineSimilarity,
  splitReasoning,
  CHAIN_OF_THOUGHT_INSTRUCTION,
} from './ai-provider';
