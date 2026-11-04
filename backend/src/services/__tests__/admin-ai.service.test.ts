/**
 * Admin AI settings + model catalog service (no DB, no network).
 */

jest.mock('../../models/admin-audit.model', () => ({
  __esModule: true,
  default: { create: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../models/ai-settings.model', () => ({
  __esModule: true,
  default: { getRaw: jest.fn(), upsert: jest.fn(), getPublic: jest.fn() },
}));

jest.mock('../../models/ai-model.model', () => ({
  __esModule: true,
  default: { upsertMany: jest.fn(), setEnabled: jest.fn(), delete: jest.fn(), listAll: jest.fn(), listEnabled: jest.fn() },
}));

jest.mock('../../providers/ai', () => ({
  __esModule: true,
  invalidateAiProviderCache: jest.fn(),
}));

jest.mock('../../providers/ai/openai-compatible.provider', () => ({
  __esModule: true,
  OpenAICompatibleProvider: jest.fn().mockImplementation(() => ({
    listModels: jest.fn().mockResolvedValue([
      { modelId: 'flyingdarkdev/chat-1', displayName: 'Chat 1' },
      { modelId: 'openai/text-embedding-3-small', displayName: 'Embed Small' },
    ]),
  })),
}));

import AiSettingsModel from '../../models/ai-settings.model';
import AiModelModel from '../../models/ai-model.model';
import { invalidateAiProviderCache } from '../../providers/ai';
import {
  fetchProviderModelsService,
  setAiModelEnabledService,
  updateAiSettingsService,
} from '../admin-ai.service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('updateAiSettingsService', () => {
  it('rejects a non-http(s) base URL', async () => {
    await expect(
      updateAiSettingsService('admin-1', { baseUrl: 'ftp://bad' }),
    ).rejects.toThrow(/valid http/);
    expect(AiSettingsModel.upsert).not.toHaveBeenCalled();
  });

  it('upserts, invalidates the provider cache, and never echoes the key', async () => {
    (AiSettingsModel.upsert as jest.Mock).mockResolvedValue({ hasKey: true, maskedKey: 'xr_1...abcd' });
    const res = await updateAiSettingsService('admin-1', {
      baseUrl: 'https://urmate.tech/api/xrouter/v1',
      apiKey: 'xr_secret',
      isEnabled: true,
    });
    expect(AiSettingsModel.upsert).toHaveBeenCalled();
    expect(invalidateAiProviderCache).toHaveBeenCalled();
    expect(JSON.stringify(res)).not.toContain('xr_secret');
  });
});

describe('fetchProviderModelsService', () => {
  it('classifies remote models by kind and inserts them (admin enables separately)', async () => {
    (AiSettingsModel.getRaw as jest.Mock).mockResolvedValue({ baseUrl: 'https://x', apiKey: 'k' });
    (AiModelModel.upsertMany as jest.Mock).mockResolvedValue(2);

    const res = await fetchProviderModelsService('admin-1');
    expect(res.fetched).toBe(2);
    const rows = (AiModelModel.upsertMany as jest.Mock).mock.calls[0][0];
    expect(rows.find((r: any) => r.modelId === 'openai/text-embedding-3-small').kind).toBe('embedding');
    expect(rows.find((r: any) => r.modelId === 'flyingdarkdev/chat-1').kind).toBe('chat');
  });
});

describe('setAiModelEnabledService', () => {
  it('errors when the model row is missing', async () => {
    (AiModelModel.setEnabled as jest.Mock).mockResolvedValue(null);
    await expect(setAiModelEnabledService('admin-1', 'id-1', true)).rejects.toThrow(/not found/i);
  });
});
