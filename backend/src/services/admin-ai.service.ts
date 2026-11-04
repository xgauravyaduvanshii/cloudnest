import AdminAuditModel from '../models/admin-audit.model';
import AiModelModel, { AiModelKind } from '../models/ai-model.model';
import AiSettingsModel from '../models/ai-settings.model';
import { invalidateAiProviderCache } from '../providers/ai';
import { OpenAICompatibleProvider } from '../providers/ai/openai-compatible.provider';
import { BadRequestException } from '../utils/app-error';

export const getAiSettingsService = async () => {
  const settings = await AiSettingsModel.getPublic();
  return { settings };
};

export const updateAiSettingsService = async (
  adminId: string | undefined,
  data: {
    provider?: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    isEnabled?: boolean;
    defaultChatModel?: string | null;
    defaultVisionModel?: string | null;
    defaultEmbeddingModel?: string | null;
  },
) => {
  if (data.baseUrl !== undefined && data.baseUrl !== null && data.baseUrl !== '') {
    try {
      const url = new URL(data.baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('bad protocol');
    } catch {
      throw new BadRequestException('Base URL must be a valid http(s) URL');
    }
  }

  const settings = await AiSettingsModel.upsert({ ...data, updatedBy: adminId ?? null });
  // Drop the memoized provider so the next AI call re-reads the new settings.
  invalidateAiProviderCache();

  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.ai.settings.update',
    entityType: 'ai_settings',
    entityId: '1',
    // Never log the key; record only which non-secret fields changed.
    metadata: {
      provider: data.provider,
      baseUrl: data.baseUrl,
      isEnabled: data.isEnabled,
      defaultChatModel: data.defaultChatModel,
      defaultEmbeddingModel: data.defaultEmbeddingModel,
      keyUpdated: data.apiKey !== undefined && data.apiKey !== null && data.apiKey !== '',
    },
  }).catch(() => null);

  return { settings };
};

const guessKind = (modelId: string): AiModelKind => {
  const id = modelId.toLowerCase();
  if (id.includes('embed')) return 'embedding';
  if (id.includes('vision') || id.includes('image') || /-vl\b|vl-/.test(id)) return 'vision';
  return 'chat';
};

/**
 * Fetch the provider's model catalog and insert any new models (disabled by default,
 * so the admin explicitly enables what users may pick). Uses the stored base URL/key
 * directly; does not require AI to be enabled.
 */
export const fetchProviderModelsService = async (adminId: string | undefined) => {
  const db = await AiSettingsModel.getRaw();
  const provider = new OpenAICompatibleProvider({
    baseUrl: db?.baseUrl ?? undefined,
    apiKey: db?.apiKey ?? undefined,
  });
  const remote = await provider.listModels();
  const inserted = await AiModelModel.upsertMany(
    remote.map((m) => ({
      modelId: m.modelId,
      displayName: m.displayName,
      kind: guessKind(m.modelId),
    })),
  );

  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.ai.models.fetch',
    entityType: 'ai_models',
    metadata: { fetched: remote.length, inserted },
  }).catch(() => null);

  return { fetched: remote.length, inserted };
};

export const listAiModelsService = async () => {
  const models = await AiModelModel.listAll();
  return { models };
};

export const setAiModelEnabledService = async (
  adminId: string | undefined,
  id: string,
  isEnabled: boolean,
) => {
  const model = await AiModelModel.setEnabled(id, isEnabled);
  if (!model) throw new BadRequestException('Model not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: isEnabled ? 'admin.ai.model.enable' : 'admin.ai.model.disable',
    entityType: 'ai_models',
    entityId: id,
    metadata: { modelId: model.modelId, kind: model.kind },
  }).catch(() => null);
  return { model };
};

export const deleteAiModelService = async (adminId: string | undefined, id: string) => {
  const deleted = await AiModelModel.delete(id);
  if (!deleted) throw new BadRequestException('Model not found');
  await AdminAuditModel.create({
    adminUserId: adminId ?? null,
    action: 'admin.ai.model.delete',
    entityType: 'ai_models',
    entityId: id,
  }).catch(() => null);
  return { deleted: true };
};

/** Enabled chat models for the user-facing model dropdown. */
export const listEnabledChatModelsService = async () => {
  const models = await AiModelModel.listEnabled('chat');
  return {
    models: models.map((m) => ({ id: m.modelId, name: m.displayName })),
  };
};
