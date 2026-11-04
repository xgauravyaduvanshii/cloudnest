/**
 * Chain-of-thought parsing + admin DB-over-env provider resolution (no DB, no network).
 */

jest.mock('../../../config/env.config', () => ({
  Env: {
    NODE_ENV: 'test',
    AI_ENABLED: 'false',
    AI_PROVIDER: 'env-provider',
    AI_BASE_URL: '',
    AI_API_KEY: '',
    AI_MODEL: 'env-chat',
    AI_VISION_MODEL: 'env-vision',
    AI_EMBEDDING_MODEL: 'env-embed',
    AI_MAX_OUTPUT_TOKENS: '1024',
  },
}));

jest.mock('../../../models/ai-settings.model', () => ({
  __esModule: true,
  default: { getRaw: jest.fn() },
}));

import AiSettingsModel from '../../../models/ai-settings.model';
import { splitReasoning } from '../ai-provider';
import { getAiProvider, invalidateAiProviderCache } from '../index';

describe('splitReasoning', () => {
  it('extracts a <thinking> block and returns the remaining answer', () => {
    const { reasoning, answer } = splitReasoning(
      '<thinking>step 1\nstep 2</thinking>\nThe final answer is 42.',
    );
    expect(reasoning).toBe('step 1\nstep 2');
    expect(answer).toBe('The final answer is 42.');
  });

  it('extracts a leading "Reasoning:" block', () => {
    const { reasoning, answer } = splitReasoning(
      'Reasoning: because files mention X.\n\nThe answer is X.',
    );
    expect(reasoning).toBe('because files mention X.');
    expect(answer).toBe('The answer is X.');
  });

  it('degrades gracefully when no reasoning is present', () => {
    const { reasoning, answer } = splitReasoning('Just a plain answer.');
    expect(reasoning).toBeNull();
    expect(answer).toBe('Just a plain answer.');
  });
});

describe('getAiProvider resolution', () => {
  beforeEach(() => {
    invalidateAiProviderCache();
    (AiSettingsModel.getRaw as jest.Mock).mockReset();
  });

  it('uses DB settings when present (configures provider from admin values)', async () => {
    (AiSettingsModel.getRaw as jest.Mock).mockResolvedValue({
      provider: 'xrouter',
      baseUrl: 'https://urmate.tech/api/xrouter/v1',
      apiKey: 'xr_test_key',
      isEnabled: true,
      defaultChatModel: 'flyingdarkdev/chat-model',
      defaultVisionModel: null,
      defaultEmbeddingModel: 'embed-model',
    });

    const provider = await getAiProvider();
    expect(provider.id).toBe('xrouter');
    expect(provider.chatModel).toBe('flyingdarkdev/chat-model');
    expect(provider.embeddingModel).toBe('embed-model');
    expect(provider.isConfigured()).toBe(true);
  });

  it('falls back to env when no DB settings exist (env disabled => not configured)', async () => {
    (AiSettingsModel.getRaw as jest.Mock).mockResolvedValue(null);
    const provider = await getAiProvider();
    expect(provider.id).toBe('env-provider');
    expect(provider.isConfigured()).toBe(false);
  });

  it('memoizes and rebuilds only after invalidation', async () => {
    (AiSettingsModel.getRaw as jest.Mock).mockResolvedValue(null);
    await getAiProvider();
    await getAiProvider();
    expect(AiSettingsModel.getRaw).toHaveBeenCalledTimes(1);
    invalidateAiProviderCache();
    await getAiProvider();
    expect(AiSettingsModel.getRaw).toHaveBeenCalledTimes(2);
  });
});
