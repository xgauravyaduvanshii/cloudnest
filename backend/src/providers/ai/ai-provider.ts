/**
 * AI provider abstraction (Phase 3). Deliberately transport-agnostic: the only
 * concrete implementation targets any OpenAI-compatible HTTP endpoint via the
 * global fetch (no SDK dependency). API keys live exclusively on the server and
 * are never returned to the client.
 */

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  /** Optional image URLs / data URLs for vision turns (user role only). */
  images?: string[];
}

export interface AiChatOptions {
  messages: AiChatMessage[];
  /** Ask the model to return a strict JSON object when true. */
  json?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AiChatResult {
  text: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface RemoteModel {
  modelId: string;
  displayName: string;
}

/** Resolved provider configuration (DB settings override env). */
export interface AiProviderConfig {
  id: string;
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  /** Whether AI is switched on (DB admin toggle, or env AI_ENABLED fallback). */
  enabled: boolean;
}

export interface AiProvider {
  readonly id: string;
  readonly chatModel: string;
  readonly visionModel: string;
  readonly embeddingModel: string;
  isConfigured(): boolean;
  chat(options: AiChatOptions): Promise<AiChatResult>;
  embed(texts: string[]): Promise<number[][]>;
  listModels(): Promise<RemoteModel[]>;
}

/** Parse a model response that should be a JSON object, tolerating code fences. */
export const parseJsonObject = <T>(text: string): T | null => {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first balanced {...} block.
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
};

/**
 * Split an optional chain-of-thought trace from a model response. Degrades
 * gracefully: when the model emits no recognizable reasoning block, `reasoning`
 * is null and the full text is returned as the answer.
 */
export const splitReasoning = (
  text: string,
): { reasoning: string | null; answer: string } => {
  const trimmedRaw = (text ?? '').trim();
  const tag = trimmedRaw.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (tag) {
    const reasoning = tag[1].trim();
    const answer =
      (trimmedRaw.slice(0, tag.index) + trimmedRaw.slice((tag.index ?? 0) + tag[0].length)).trim();
    return { reasoning: reasoning || null, answer };
  }
  const lead = trimmedRaw.match(
    /^reasoning:\s*([\s\S]*?)(?:\n\s*\n|\nanswer:)/i,
  );
  if (lead) {
    const reasoning = lead[1].trim();
    const answer = trimmedRaw.slice(lead[0].length).replace(/^\s*answer:\s*/i, '').trim();
    return { reasoning: reasoning || null, answer };
  }
  return { reasoning: null, answer: trimmedRaw };
};

/** Prompt suffix asking for a brief, separable reasoning trace before the answer. */
export const CHAIN_OF_THOUGHT_INSTRUCTION =
  'Before answering, briefly reason step-by-step inside a single <thinking>...</thinking> block, ' +
  'then give your final answer after the closing tag. Keep the thinking to a few concise sentences.';

/** Cosine similarity between two equal-length vectors (0 when undefined). */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};
