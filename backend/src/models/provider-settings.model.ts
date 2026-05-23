import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';
import { StorageProviderType } from './storage-account.model';

interface ProviderSettingsRow extends QueryResultRow {
  id: string;
  provider: StorageProviderType;
  encrypted_config: string | null;
  is_configured: boolean;
  is_enabled: boolean;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProviderSettingsDocument {
  id: string;
  provider: StorageProviderType;
  encryptedConfig: string | null;
  isConfigured: boolean;
  isEnabled: boolean;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toProviderSettingsDocument = (
  row: ProviderSettingsRow,
): ProviderSettingsDocument => ({
  id: row.id,
  provider: row.provider,
  encryptedConfig: row.encrypted_config,
  isConfigured: row.is_configured,
  isEnabled: row.is_enabled,
  updatedBy: row.updated_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const ProviderSettingsModel = {
  async findByProvider(provider: StorageProviderType) {
    const result = await query<ProviderSettingsRow>(
      `SELECT *
       FROM provider_settings
       WHERE provider = $1`,
      [provider],
    );
    return result.rows[0] ? toProviderSettingsDocument(result.rows[0]) : null;
  },

  async findAll() {
    const result = await query<ProviderSettingsRow>(
      `SELECT *
       FROM provider_settings
       ORDER BY provider`,
    );
    return result.rows.map(toProviderSettingsDocument);
  },

  async upsert(data: {
    provider: StorageProviderType;
    encryptedConfig?: string | null;
    isConfigured?: boolean;
    isEnabled?: boolean;
    updatedBy?: string | null;
  }) {
    const result = await query<ProviderSettingsRow>(
      `INSERT INTO provider_settings (
        provider,
        encrypted_config,
        is_configured,
        is_enabled,
        updated_by
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (provider)
      DO UPDATE SET
        encrypted_config = COALESCE(EXCLUDED.encrypted_config, provider_settings.encrypted_config),
        is_configured = COALESCE(EXCLUDED.is_configured, provider_settings.is_configured),
        is_enabled = COALESCE(EXCLUDED.is_enabled, provider_settings.is_enabled),
        updated_by = EXCLUDED.updated_by
      RETURNING *`,
      [
        data.provider,
        data.encryptedConfig || null,
        data.isConfigured ?? false,
        data.isEnabled ?? null,
        data.updatedBy || null,
      ],
    );
    return toProviderSettingsDocument(result.rows[0]);
  },
};

export default ProviderSettingsModel;
