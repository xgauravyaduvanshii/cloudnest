import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';
import { decryptText, encryptText } from '../utils/crypto';

interface AiSettingsRow extends QueryResultRow {
  id: number;
  provider: string;
  base_url: string | null;
  encrypted_api_key: string | null;
  is_enabled: boolean;
  default_chat_model: string | null;
  default_vision_model: string | null;
  default_embedding_model: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

/** Internal, decrypted view used only server-side to build the provider. */
export interface AiSettingsRaw {
  provider: string;
  baseUrl: string | null;
  apiKey: string | null;
  isEnabled: boolean;
  defaultChatModel: string | null;
  defaultVisionModel: string | null;
  defaultEmbeddingModel: string | null;
}

/** Public view safe to return to the admin client (never includes the key). */
export interface AiSettingsPublic {
  provider: string;
  baseUrl: string | null;
  hasKey: boolean;
  maskedKey: string | null;
  isEnabled: boolean;
  defaultChatModel: string | null;
  defaultVisionModel: string | null;
  defaultEmbeddingModel: string | null;
  updatedAt: Date;
}

const maskKey = (apiKey: string | null) =>
  apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : null;

const toRaw = (row: AiSettingsRow): AiSettingsRaw => ({
  provider: row.provider,
  baseUrl: row.base_url,
  apiKey: row.encrypted_api_key ? decryptText(row.encrypted_api_key) : null,
  isEnabled: !!row.is_enabled,
  defaultChatModel: row.default_chat_model,
  defaultVisionModel: row.default_vision_model,
  defaultEmbeddingModel: row.default_embedding_model,
});

const toPublic = (row: AiSettingsRow): AiSettingsPublic => {
  const apiKey = row.encrypted_api_key ? decryptText(row.encrypted_api_key) : null;
  return {
    provider: row.provider,
    baseUrl: row.base_url,
    hasKey: !!apiKey,
    maskedKey: maskKey(apiKey),
    isEnabled: !!row.is_enabled,
    defaultChatModel: row.default_chat_model,
    defaultVisionModel: row.default_vision_model,
    defaultEmbeddingModel: row.default_embedding_model,
    updatedAt: row.updated_at,
  };
};

const AiSettingsModel = {
  async getRaw(): Promise<AiSettingsRaw | null> {
    const result = await query<AiSettingsRow>(
      `SELECT * FROM ai_settings WHERE id = 1`,
    );
    return result.rows[0] ? toRaw(result.rows[0]) : null;
  },

  async getPublic(): Promise<AiSettingsPublic | null> {
    const result = await query<AiSettingsRow>(
      `SELECT * FROM ai_settings WHERE id = 1`,
    );
    return result.rows[0] ? toPublic(result.rows[0]) : null;
  },

  /**
   * Upsert the single settings row. `apiKey` is encrypted here; pass undefined to
   * leave the stored key unchanged (COALESCE), null to clear it.
   */
  async upsert(data: {
    provider?: string;
    baseUrl?: string | null;
    apiKey?: string | null;
    isEnabled?: boolean;
    defaultChatModel?: string | null;
    defaultVisionModel?: string | null;
    defaultEmbeddingModel?: string | null;
    updatedBy?: string | null;
  }) {
    const encrypted =
      data.apiKey === undefined
        ? null
        : data.apiKey === null
          ? ''
          : encryptText(data.apiKey);

    const result = await query<AiSettingsRow>(
      `INSERT INTO ai_settings (
         id, provider, base_url, encrypted_api_key, is_enabled,
         default_chat_model, default_vision_model, default_embedding_model, updated_by
       )
       VALUES (1, COALESCE($1, 'openai'), $2,
               CASE WHEN $3::text IS NULL THEN NULL WHEN $3 = '' THEN NULL ELSE $3 END,
               COALESCE($4, FALSE), $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE SET
         provider = COALESCE(EXCLUDED.provider, ai_settings.provider),
         base_url = COALESCE(EXCLUDED.base_url, ai_settings.base_url),
         encrypted_api_key = CASE
           WHEN $3::text IS NULL THEN ai_settings.encrypted_api_key
           WHEN $3 = '' THEN NULL
           ELSE EXCLUDED.encrypted_api_key END,
         is_enabled = COALESCE(EXCLUDED.is_enabled, ai_settings.is_enabled),
         default_chat_model = COALESCE(EXCLUDED.default_chat_model, ai_settings.default_chat_model),
         default_vision_model = COALESCE(EXCLUDED.default_vision_model, ai_settings.default_vision_model),
         default_embedding_model = COALESCE(EXCLUDED.default_embedding_model, ai_settings.default_embedding_model),
         updated_by = EXCLUDED.updated_by,
         updated_at = NOW()
       RETURNING *`,
      [
        data.provider ?? null,
        data.baseUrl ?? null,
        encrypted,
        data.isEnabled ?? null,
        data.defaultChatModel ?? null,
        data.defaultVisionModel ?? null,
        data.defaultEmbeddingModel ?? null,
        data.updatedBy ?? null,
      ],
    );
    return toPublic(result.rows[0]);
  },
};

export default AiSettingsModel;
