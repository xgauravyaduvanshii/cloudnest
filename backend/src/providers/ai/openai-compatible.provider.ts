import { Env } from '../../config/env.config';
import { InternalServerException } from '../../utils/app-error';
import { logger } from '../../utils/logger';
import type {
  AiChatMessage,
  AiChatOptions,
  AiChatResult,
  AiProvider,
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

/**
 * A single provider implementation covering every OpenAI-compatible /chat/completions
 * and /embeddings endpoint (OpenAI, Groq, Together, Fireworks, local Ollama, etc.).
 */
export class OpenAICompatibleProvider implements AiProvider {
  readonly id: string;
  readonly chatModel: string;
  readonly visionModel: string;
  readonly embeddingModel: string;

  constructor(id = Env.AI_PROVIDER) {
    this.id = id;
    this.chatModel = Env.AI_MODEL;
    this.visionModel = Env.AI_VISION_MODEL;
    this.embeddingModel = Env.AI_EMBEDDING_MODEL;
  }

  isConfigured(): boolean {
    return Env.AI_ENABLED === 'true' && !!Env.AI_API_KEY && !!Env.AI_BASE_URL;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new InternalServerException(
        'AI is not configured. Set AI_ENABLED, AI_API_KEY and AI_BASE_URL.',
      );
    }
  }

  private async post(path: string, body: unknown): Promise<any> {
    const base = Env.AI_BASE_URL.replace(/\/$/, '');
    const response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Env.AI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      logger.error('AI provider request failed', { status: response.status, detail });
      throw new InternalServerException(`AI provider error (${response.status})`);
    }
    return response.json();
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
}
