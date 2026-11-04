import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type StorageProviderType = 'S3' | 'GOOGLE_DRIVE' | 'TELEGRAM';
export type StorageOwnerType = 'USER' | 'ADMIN';
export type StorageAccountStatus =
  | 'ACTIVE'
  | 'DISABLED'
  | 'ERROR'
  | 'PENDING_AUTH';

type Queryable = Pick<PoolClient, 'query'>;

interface StorageAccountRow extends QueryResultRow {
  id: string;
  user_id: string | null;
  owner_type: StorageOwnerType;
  provider: StorageProviderType;
  display_name: string;
  status: StorageAccountStatus;
  encrypted_credentials: string | null;
  external_account_id: string | null;
  external_email: string | null;
  root_folder_id: string | null;
  soft_quota_bytes: number | null;
  cached_usage_bytes: number;
  cached_limit_bytes: number | null;
  cached_usage_details: Record<string, unknown>;
  max_upload_concurrency?: number;
  last_synced_at: Date | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface StorageAccountDocument {
  _id: string;
  id: string;
  userId: string | null;
  ownerType: StorageOwnerType;
  provider: StorageProviderType;
  displayName: string;
  status: StorageAccountStatus;
  encryptedCredentials: string | null;
  externalAccountId: string | null;
  externalEmail: string | null;
  rootFolderId: string | null;
  softQuotaBytes: number | null;
  cachedUsageBytes: number;
  cachedLimitBytes: number | null;
  cachedUsageDetails: Record<string, unknown>;
  maxUploadConcurrency: number;
  lastSyncedAt: Date | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toNumberOrNull = (value: number | string | null) =>
  value === null ? null : Number(value);

const toStorageAccountDocument = (
  row: StorageAccountRow,
): StorageAccountDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  ownerType: row.owner_type,
  provider: row.provider,
  displayName: row.display_name,
  status: row.status,
  encryptedCredentials: row.encrypted_credentials,
  externalAccountId: row.external_account_id,
  externalEmail: row.external_email,
  rootFolderId: row.root_folder_id,
  softQuotaBytes: toNumberOrNull(row.soft_quota_bytes),
  cachedUsageBytes: Number(row.cached_usage_bytes),
  cachedLimitBytes: toNumberOrNull(row.cached_limit_bytes),
  cachedUsageDetails: row.cached_usage_details || {},
  maxUploadConcurrency: Number(row.max_upload_concurrency ?? 3) || 3,
  lastSyncedAt: row.last_synced_at,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const StorageAccountModel = {
  async create(
    data: {
      userId?: string | null;
      ownerType: StorageOwnerType;
      provider: StorageProviderType;
      displayName: string;
      status?: StorageAccountStatus;
      encryptedCredentials?: string | null;
      externalAccountId?: string | null;
      externalEmail?: string | null;
      rootFolderId?: string | null;
      softQuotaBytes?: number | null;
      cachedUsageBytes?: number;
      cachedLimitBytes?: number | null;
      cachedUsageDetails?: Record<string, unknown>;
    },
    client?: Queryable,
  ) {
    const result = await runQuery<StorageAccountRow>(
      `INSERT INTO storage_accounts (
        user_id,
        owner_type,
        provider,
        display_name,
        status,
        encrypted_credentials,
        external_account_id,
        external_email,
        root_folder_id,
        soft_quota_bytes,
        cached_usage_bytes,
        cached_limit_bytes,
        cached_usage_details
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        data.userId || null,
        data.ownerType,
        data.provider,
        data.displayName,
        data.status || 'ACTIVE',
        data.encryptedCredentials || null,
        data.externalAccountId || null,
        data.externalEmail || null,
        data.rootFolderId || null,
        data.softQuotaBytes ?? null,
        data.cachedUsageBytes || 0,
        data.cachedLimitBytes ?? null,
        JSON.stringify(data.cachedUsageDetails || {}),
      ],
      client,
    );
    return toStorageAccountDocument(result.rows[0]);
  },

  async findById(id: string, client?: Queryable) {
    const result = await runQuery<StorageAccountRow>(
      `SELECT *
       FROM storage_accounts
       WHERE id = $1`,
      [id],
      client,
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async findActiveReplacementForAccount(
    account: StorageAccountDocument,
    client?: Queryable,
  ) {
    const result = await runQuery<StorageAccountRow>(
      `SELECT *
       FROM storage_accounts
       WHERE id <> $1
         AND provider = $2
         AND status = 'ACTIVE'
         AND owner_type = $3
         AND user_id IS NOT DISTINCT FROM $4::uuid
         AND (
           ($5::text IS NOT NULL AND external_email = $5::text)
           OR ($6::text IS NOT NULL AND external_account_id = $6::text)
           OR (
             $5::text IS NULL
             AND $6::text IS NULL
             AND display_name = $7::text
           )
         )
       ORDER BY
         CASE
           WHEN $5::text IS NOT NULL AND external_email = $5::text THEN 0
           WHEN $6::text IS NOT NULL AND external_account_id = $6::text THEN 1
           ELSE 2
         END,
         updated_at DESC
       LIMIT 1`,
      [
        account.id,
        account.provider,
        account.ownerType,
        account.userId,
        account.externalEmail,
        account.externalAccountId,
        account.displayName,
      ],
      client,
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async findDefaultS3Admin(client?: Queryable) {
    const result = await runQuery<StorageAccountRow>(
      `SELECT *
       FROM storage_accounts
       WHERE provider = 'S3'
         AND owner_type = 'ADMIN'
         AND external_account_id = 'default-s3'
       LIMIT 1`,
      [],
      client,
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async findEligibleForUser(userId: string) {
    const result = await query<StorageAccountRow>(
      `SELECT sa.*,
        COALESCE(SUM(f.size), 0)::bigint AS app_usage_bytes
       FROM storage_accounts sa
       LEFT JOIN files f ON f.storage_account_id = sa.id
       WHERE sa.status = 'ACTIVE'
         AND (sa.user_id = $1 OR sa.owner_type = 'ADMIN')
       GROUP BY sa.id
       ORDER BY sa.created_at ASC`,
      [userId],
    );
    return result.rows.map(toStorageAccountDocument);
  },

  async findAll(options: {
    keyword?: string;
    userId?: string;
    provider?: StorageProviderType;
    status?: StorageAccountStatus;
    ownerType?: StorageOwnerType;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.keyword) {
      params.push(`%${options.keyword}%`);
      conditions.push(
        `(display_name ILIKE $${params.length} OR external_email ILIKE $${params.length})`,
      );
    }
    if (options.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (options.provider) {
      params.push(options.provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options.ownerType) {
      params.push(options.ownerType);
      conditions.push(`owner_type = $${params.length}`);
    }

    params.push(options.limit, options.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const result = await query<StorageAccountRow>(
      `SELECT *
       FROM storage_accounts
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${limitParam}
       OFFSET $${offsetParam}`,
      params,
    );
    return result.rows.map(toStorageAccountDocument);
  },

  async countAll(options: {
    keyword?: string;
    userId?: string;
    provider?: StorageProviderType;
    status?: StorageAccountStatus;
    ownerType?: StorageOwnerType;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.keyword) {
      params.push(`%${options.keyword}%`);
      conditions.push(
        `(display_name ILIKE $${params.length} OR external_email ILIKE $${params.length})`,
      );
    }
    if (options.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (options.provider) {
      params.push(options.provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (options.status) {
      params.push(options.status);
      conditions.push(`status = $${params.length}`);
    }
    if (options.ownerType) {
      params.push(options.ownerType);
      conditions.push(`owner_type = $${params.length}`);
    }

    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM storage_accounts
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params,
    );
    return result.rows[0]?.count || 0;
  },

  async updateCredentials(
    id: string,
    data: {
      encryptedCredentials?: string | null;
      displayName?: string;
      status?: StorageAccountStatus;
      externalAccountId?: string | null;
      externalEmail?: string | null;
      rootFolderId?: string | null;
      softQuotaBytes?: number | null;
    },
    client?: Queryable,
  ) {
    const updates: string[] = [];
    const params: unknown[] = [];

    const push = (field: string, value: unknown) => {
      params.push(value);
      updates.push(`${field} = $${params.length}`);
    };

    if (data.encryptedCredentials !== undefined)
      push('encrypted_credentials', data.encryptedCredentials);
    if (data.displayName !== undefined) push('display_name', data.displayName);
    if (data.status !== undefined) push('status', data.status);
    if (data.externalAccountId !== undefined)
      push('external_account_id', data.externalAccountId);
    if (data.externalEmail !== undefined) push('external_email', data.externalEmail);
    if (data.rootFolderId !== undefined) push('root_folder_id', data.rootFolderId);
    if (data.softQuotaBytes !== undefined)
      push('soft_quota_bytes', data.softQuotaBytes);

    if (!updates.length) return this.findById(id, client);

    params.push(id);
    const result = await runQuery<StorageAccountRow>(
      `UPDATE storage_accounts
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
      client,
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async updateUsage(
    id: string,
    data: {
      usageBytes: number;
      limitBytes?: number | null;
      usageDetails?: Record<string, unknown>;
      status?: StorageAccountStatus;
      errorMessage?: string | null;
    },
  ) {
    const result = await query<StorageAccountRow>(
      `UPDATE storage_accounts
       SET
         cached_usage_bytes = $1,
         cached_limit_bytes = $2,
         cached_usage_details = $3,
         last_synced_at = NOW(),
         status = COALESCE($4, status),
         error_message = $5
       WHERE id = $6
       RETURNING *`,
      [
        data.usageBytes,
        data.limitBytes ?? null,
        JSON.stringify(data.usageDetails || {}),
        data.status || null,
        data.errorMessage || null,
        id,
      ],
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async updateStatus(
    id: string,
    status: StorageAccountStatus,
    errorMessage?: string | null,
  ) {
    const result = await query<StorageAccountRow>(
      `UPDATE storage_accounts
       SET status = $1,
           error_message = $2
       WHERE id = $3
       RETURNING *`,
      [status, errorMessage || null, id],
    );
    return result.rows[0] ? toStorageAccountDocument(result.rows[0]) : null;
  },

  async delete(id: string) {
    const result = await query(
      `DELETE FROM storage_accounts
       WHERE id = $1`,
      [id],
    );
    return result.rowCount || 0;
  },

  async calculateAppUsage(id: string) {
    const result = await query<{ total_size: number }>(
      `SELECT COALESCE(SUM(size), 0)::bigint AS total_size
       FROM files
       WHERE storage_account_id = $1`,
      [id],
    );
    return Number(result.rows[0]?.total_size || 0);
  },

  async providerStats() {
    const result = await query<{
      provider: StorageProviderType;
      accounts: number;
      active_accounts: number;
      cached_usage_bytes: number;
      cached_limit_bytes: number | null;
    }>(
      `SELECT
        provider,
        COUNT(*)::int AS accounts,
        COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active_accounts,
        COALESCE(SUM(cached_usage_bytes), 0)::bigint AS cached_usage_bytes,
        SUM(cached_limit_bytes)::bigint AS cached_limit_bytes
       FROM storage_accounts
       GROUP BY provider
       ORDER BY provider`,
    );
    return result.rows;
  },
};

export default StorageAccountModel;
