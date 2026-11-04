import { Env } from '../../config/env.config';
import { InternalServerException } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import type {
  AiChatMessage,
  AiChatOptions,
  AiChatResult,
  AiProvider,
  AiProviderConfig,
  RemoteModel,
} from './ai-provider';

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type WireMessage = { role: string; content: string | ContentPart[] };

const buildContent = (message: AiChatMessage): string | ContentPart[] => {
  if (message.role === 'user' && message.images?.length) {
    const parts: ContentPart[] = [{ type: 'text', text: message.content }];
    for (const url of message.images) {
      parts.push({ type: 'image_url', image_url: { url } });
    }
    return parts;
  }
  return message.content;
};

const humanizeModelId = (modelId: string): string => {
  const tail = modelId.split('/').pop() ?? modelId;
  return tail.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/**
 * A single provider implementation covering every OpenAI-compatible /chat/completions,
 * /embeddings and /models endpoint (OpenAI, Groq, Together, XRouter, local Ollama, etc.).
 * Configuration is injected (resolved from admin DB settings, falling back to env).
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly id: string;
  readonly chatModel: string;
  readonly visionModel: string;
  readonly embeddingModel: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(config?: Partial<AiProviderConfig>) {
    this.id = config?.id ?? Env.AI_PROVIDER;
    this.baseUrl = config?.baseUrl ?? Env.AI_BASE_URL;
    this.apiKey = config?.apiKey ?? Env.AI_API_KEY;
    this.chatModel = config?.chatModel ?? Env.AI_MODEL;
    this.visionModel = config?.visionModel ?? Env.AI_VISION_MODEL;
    this.embeddingModel = config?.embeddingModel ?? Env.AI_EMBEDDING_MODEL;
    this.enabled = config?.enabled ?? Env.AI_ENABLED === 'true';
  }

  isConfigured(): boolean {
    return this.enabled && !!this.apiKey && !!this.baseUrl;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new InternalServerException(
        'AI is not configured. Set the provider in the admin panel (or AI_* env vars).',
      );
    }
  }

  private async request(path: string, init: RequestInit): Promise<any> {
    const base = this.baseUrl.replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error('AI provider request failed', { status: response.status, detail });
      throw new InternalServerException(`AI provider error (${response.status})`);
    }
    return response.json();
  }

  private async post(path: string, body: unknown): Promise<any> {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  }

  async chat(options: AiChatOptions): Promise<AiChatResult> {
    this.assertConfigured();
    const hasImages = options.messages.some((m) => m.images?.length);
    const model = options.model ?? (hasImages ? this.visionModel : this.chatModel);

    const wire: WireMessage[] = options.messages.map((m) => ({
      role: m.role,
      content: buildContent(m),
    }));

    const payload: Record<string, unknown> = {
      model,
      messages: wire,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? Number(Env.AI_MAX_OUTPUT_TOKENS || 1024),
    };
    if (options.json) payload.response_format = { type: 'json_object' };

    const data = await this.post('/chat/completions', payload);
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    return {
      text,
      model: data?.model ?? model,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? 0,
            completionTokens: data.usage.completion_tokens ?? 0,
          }
        : undefined,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.assertConfigured();
    const data = await this.post('/embeddings', {
      model: this.embeddingModel,
      input: texts,
    });
    const rows: { index: number; embedding: number[] }[] = data?.data ?? [];
    return [...rows]
      .sort((a, b) => a.index - b.index)
      .map((r) => r.embedding);
  }

  /**
   * List models from the provider's /models endpoint. Uses the configured key/base
   * URL directly (does not require the enabled toggle, so an admin can fetch the
   * catalog before switching AI on).
   */
  async listModels(): Promise<RemoteModel[]> {
    if (!this.apiKey || !this.baseUrl) {
      throw new InternalServerException(
        'AI provider is not configured. Set the base URL and API key first.',
      );
    }
    const data = await this.request('/models', { method: 'GET' });
    const rows: { id?: string; name?: string }[] = data?.data ?? [];
    return rows
      .map((r) => {
        const modelId = r.id ?? r.name;
        if (!modelId) return null;
        return { modelId, displayName: r.name ? r.name : humanizeModelId(modelId) };
      })
      .filter((r): r is RemoteModel => !!r);
  }
}
