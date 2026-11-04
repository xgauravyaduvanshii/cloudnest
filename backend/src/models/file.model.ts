import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';
import { formatBytes } from '../utils/format-byte';
import { StorageProviderType } from './storage-account.model';

export enum UploadSourceEnum {
  WEB = 'WEB',
  API = 'API',
}

interface FileRow extends QueryResultRow {
  id: string;
  user_id: string;
  original_name: string;
  storage_key: string;
  provider: StorageProviderType;
  storage_account_id: string | null;
  storage_account_name?: string | null;
  folder_id: string | null;
  folder_name?: string | null;
  provider_file_id: string | null;
  provider_metadata: Record<string, unknown>;
  mime_type: string;
  size: number;
  ext: string;
  upload_via: keyof typeof UploadSourceEnum;
  url: string;
  checksum_sha256?: string | null;
  original_path?: string | null;
  provider_folder_id?: string | null;
  version_group_id?: string | null;
  supersedes_file_id?: string | null;
  version_number?: number;
  is_latest?: boolean;
  upload_job_item_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

type Queryable = Pick<PoolClient, 'query'>;

export interface FileDocument {
  _id: string;
  id: string;
  userId: string;
  originalName: string;
  storageKey: string;
  provider: StorageProviderType;
  storageAccountId: string | null;
  storageAccountName?: string | null;
  folderId: string | null;
  folderName?: string | null;
  providerFileId: string | null;
  providerMetadata: Record<string, unknown>;
  mimeType: string;
  size: number; //bytes
  formattedSize: string;
  ext: string;
  uploadVia: keyof typeof UploadSourceEnum;
  url: string;
  checksumSha256: string | null;
  originalPath: string | null;
  providerFolderId: string | null;
  versionGroupId: string | null;
  supersedesFileId: string | null;
  versionNumber: number;
  isLatest: boolean;
  uploadJobItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toFileDocument = (row: FileRow): FileDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  originalName: row.original_name,
  storageKey: row.storage_key,
  provider: row.provider,
  storageAccountId: row.storage_account_id,
  storageAccountName: row.storage_account_name || null,
  folderId: row.folder_id,
  folderName: row.folder_name || null,
  providerFileId: row.provider_file_id,
  providerMetadata: row.provider_metadata || {},
  mimeType: row.mime_type,
  size: row.size,
  formattedSize: formatBytes(row.size),
  ext: row.ext,
  uploadVia: row.upload_via,
  url: row.url,
  checksumSha256: row.checksum_sha256 ?? null,
  originalPath: row.original_path ?? null,
  providerFolderId: row.provider_folder_id ?? null,
  versionGroupId: row.version_group_id ?? null,
  supersedesFileId: row.supersedes_file_id ?? null,
  versionNumber: row.version_number ?? 1,
  isLatest: row.is_latest ?? true,
  uploadJobItemId: row.upload_job_item_id ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const buildSearch = (
  keyword?: string,
  folderId?: string | null,
  provider?: StorageProviderType,
) => {
  const clauses = ['user_id = $1'];
  const params: unknown[] = [];

  if (provider) {
    params.push(provider);
    clauses.push(`provider = $${params.length + 1}`);
  }

  if (folderId) {
    params.push(folderId);
    clauses.push(`folder_id = $${params.length + 1}`);
  } else {
    clauses.push('folder_id IS NULL');
  }

  if (keyword) {
    params.push(`%${keyword}%`);
    clauses.push(`original_name ILIKE $${params.length + 1}`);
  }

  return {
    clause: clauses.join(' AND '),
    params,
  };
};

const FileModel = {
  async create(data: {
    userId: string;
    originalName: string;
    storageKey: string;
    provider: StorageProviderType;
    storageAccountId: string;
    folderId?: string | null;
    providerFileId?: string | null;
    providerMetadata?: Record<string, unknown>;
    mimeType: string;
    size: number;
    ext: string;
    uploadVia: keyof typeof UploadSourceEnum;
    url?: string;
    checksumSha256?: string | null;
    originalPath?: string | null;
    providerFolderId?: string | null;
    versionGroupId?: string | null;
    supersedesFileId?: string | null;
    versionNumber?: number;
    isLatest?: boolean;
    uploadJobItemId?: string | null;
  }) {
    const result = await query<FileRow>(
      `INSERT INTO files (
        user_id,
        original_name,
        storage_key,
        provider,
        storage_account_id,
        folder_id,
        provider_file_id,
        provider_metadata,
        mime_type,
        size,
        ext,
        upload_via,
        url,
        checksum_sha256,
        original_path,
        provider_folder_id,
        version_group_id,
        supersedes_file_id,
        version_number,
        is_latest,
        upload_job_item_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        data.userId,
        data.originalName,
        data.storageKey,
        data.provider,
        data.storageAccountId,
        data.folderId || null,
        data.providerFileId || null,
        JSON.stringify(data.providerMetadata || {}),
        data.mimeType,
        data.size,
        data.ext,
        data.uploadVia,
        data.url || '',
        data.checksumSha256 || null,
        data.originalPath || null,
        data.providerFolderId || null,
        data.versionGroupId || null,
        data.supersedesFileId || null,
        data.versionNumber ?? 1,
        data.isLatest ?? true,
        data.uploadJobItemId || null,
      ],
    );
    return toFileDocument(result.rows[0]);
  },

  /**
   * Find an existing latest file that is an exact duplicate: same user, account,
   * target folder, normalized name, and checksum. Used to skip redundant uploads.
   */
  async findExactDuplicate(data: {
    userId: string;
    storageAccountId: string;
    providerFolderId?: string | null;
    originalName: string;
    checksumSha256: string;
  }) {
    const result = await query<FileRow>(
      `SELECT * FROM files
       WHERE user_id = $1
         AND storage_account_id = $2
         AND COALESCE(provider_folder_id, '') = $3
         AND LOWER(original_name) = LOWER($4)
         AND checksum_sha256 = $5
       ORDER BY created_at DESC
       LIMIT 1`,
      [
        data.userId,
        data.storageAccountId,
        data.providerFolderId || '',
        data.originalName,
        data.checksumSha256,
      ],
    );
    return result.rows[0] ? toFileDocument(result.rows[0]) : null;
  },

  /**
   * Find the current latest file with the same name in a target folder (any checksum),
   * used to establish version lineage when conflict policy is VERSION.
   */
  async findLatestByName(data: {
    userId: string;
    storageAccountId: string;
    providerFolderId?: string | null;
    originalName: string;
  }) {
    const result = await query<FileRow>(
      `SELECT * FROM files
       WHERE user_id = $1
         AND storage_account_id = $2
         AND COALESCE(provider_folder_id, '') = $3
         AND LOWER(original_name) = LOWER($4)
         AND is_latest = TRUE
       ORDER BY version_number DESC, created_at DESC
       LIMIT 1`,
      [
        data.userId,
        data.storageAccountId,
        data.providerFolderId || '',
        data.originalName,
      ],
    );
    return result.rows[0] ? toFileDocument(result.rows[0]) : null;
  },

  /**
   * Mark a file (and its version group) as no longer the latest, and link a new
   * version into that group. Returns the number of rows superseded.
   */
  async markNotLatest(fileId: string, client?: Queryable) {
    const result = await runQuery(
      `UPDATE files SET is_latest = FALSE WHERE id = $1`,
      [fileId],
      client,
    );
    return result.rowCount || 0;
  },

  async setVersionGroup(fileId: string, versionGroupId: string, client?: Queryable) {
    await runQuery(
      `UPDATE files SET version_group_id = $2 WHERE id = $1`,
      [fileId, versionGroupId],
      client,
    );
  },

  async findById(fileId: string) {
    const result = await query<FileRow>(
      `SELECT f.*, sa.display_name AS storage_account_name, fo.name AS folder_name
       FROM files f
       LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
       LEFT JOIN folders fo ON fo.id = f.folder_id
       WHERE f.id = $1`,
      [fileId],
    );
    return result.rows[0] ? toFileDocument(result.rows[0]) : null;
  },

  async findAllByUser(
    userId: string,
    keyword: string | undefined,
    pagination: { limit: number; offset: number },
    folderId?: string | null,
    provider?: StorageProviderType,
  ) {
    const clauses = ['f.user_id = $1'];
    const keywordParams: unknown[] = [];

    if (provider) {
      keywordParams.push(provider);
      clauses.push(`f.provider = $${keywordParams.length + 1}`);
    }

    if (folderId) {
      keywordParams.push(folderId);
      clauses.push(`f.folder_id = $${keywordParams.length + 1}`);
    } else {
      clauses.push('f.folder_id IS NULL');
    }

    if (keyword) {
      keywordParams.push(`%${keyword}%`);
      clauses.push(`f.original_name ILIKE $${keywordParams.length + 1}`);
    }

    const params = [userId, ...keywordParams, pagination.limit, pagination.offset];
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const result = await query<FileRow>(
      `SELECT f.*, sa.display_name AS storage_account_name, fo.name AS folder_name
       FROM files f
       LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
       LEFT JOIN folders fo ON fo.id = f.folder_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY f.created_at DESC
       LIMIT $${limitParam}
       OFFSET $${offsetParam}`,
      params,
    );

    return result.rows.map(toFileDocument);
  },

  async countByUser(
    userId: string,
    keyword?: string,
    folderId?: string | null,
    provider?: StorageProviderType,
  ) {
    const search = buildSearch(keyword, folderId, provider);
    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM files
       WHERE ${search.clause}`,
      [userId, ...search.params],
    );
    return result.rows[0]?.count || 0;
  },

  async findByIdsForUser(fileIds: string[], userId: string) {
    if (!fileIds.length) return [];

    const result = await query<FileRow>(
      `SELECT f.*, sa.display_name AS storage_account_name, fo.name AS folder_name
       FROM files f
       LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
       LEFT JOIN folders fo ON fo.id = f.folder_id
       WHERE f.user_id = $1
       AND f.id = ANY($2::uuid[])
       ORDER BY f.created_at DESC`,
      [userId, fileIds],
    );
    return result.rows.map(toFileDocument);
  },

  async findByIds(fileIds: string[]) {
    if (!fileIds.length) return [];

    const result = await query<FileRow>(
      `SELECT f.*, sa.display_name AS storage_account_name, fo.name AS folder_name
       FROM files f
       LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
       LEFT JOIN folders fo ON fo.id = f.folder_id
       WHERE f.id = ANY($1::uuid[])
       ORDER BY f.created_at DESC`,
      [fileIds],
    );
    return result.rows.map(toFileDocument);
  },

  async deleteByIdsForUser(
    fileIds: string[],
    userId: string,
    client?: Queryable,
  ) {
    if (!fileIds.length) return 0;

    const result = await runQuery(
      `DELETE FROM files
       WHERE user_id = $1
       AND id = ANY($2::uuid[])`,
      [userId, fileIds],
      client,
    );
    return result.rowCount || 0;
  },

  async moveByIdsForUser(
    fileIds: string[],
    userId: string,
    provider: StorageProviderType,
    folderId: string | null,
    client?: Queryable,
  ) {
    const result = await runQuery(
      `UPDATE files
       SET folder_id = $1
       WHERE user_id = $2
         AND provider = $3
         AND id = ANY($4::uuid[])`,
      [folderId, userId, provider, fileIds],
      client,
    );
    return result.rowCount || 0;
  },

  async deleteByIds(fileIds: string[], client?: Queryable) {
    if (!fileIds.length) return 0;

    const result = await runQuery(
      `DELETE FROM files
       WHERE id = ANY($1::uuid[])`,
      [fileIds],
      client,
    );
    return result.rowCount || 0;
  },

  async calculateUsage(userId: string, client?: Queryable): Promise<number> {
    const result = await runQuery<{ total_size: number }>(
      `SELECT COALESCE(SUM(size), 0)::bigint AS total_size
       FROM files
       WHERE user_id = $1`,
      [userId],
      client,
    );
    return result.rows[0]?.total_size || 0;
  },

  async findAllAdmin(options: {
    keyword?: string;
    userId?: string;
    provider?: StorageProviderType;
    storageAccountId?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.keyword) {
      params.push(`%${options.keyword}%`);
      conditions.push(`f.original_name ILIKE $${params.length}`);
    }
    if (options.userId) {
      params.push(options.userId);
      conditions.push(`f.user_id = $${params.length}`);
    }
    if (options.provider) {
      params.push(options.provider);
      conditions.push(`f.provider = $${params.length}`);
    }
    if (options.storageAccountId) {
      params.push(options.storageAccountId);
      conditions.push(`f.storage_account_id = $${params.length}`);
    }

    params.push(options.limit, options.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const result = await query<FileRow & { user_email: string; user_name: string }>(
      `SELECT
         f.*,
         sa.display_name AS storage_account_name,
         fo.name AS folder_name,
         u.email AS user_email,
         u.name AS user_name
       FROM files f
       JOIN users u ON u.id = f.user_id
       LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
       LEFT JOIN folders fo ON fo.id = f.folder_id
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY f.created_at DESC
       LIMIT $${limitParam}
       OFFSET $${offsetParam}`,
      params,
    );

    return result.rows.map((row) => ({
      ...toFileDocument(row),
      userEmail: row.user_email,
      userName: row.user_name,
    }));
  },

  async countAllAdmin(options: {
    keyword?: string;
    userId?: string;
    provider?: StorageProviderType;
    storageAccountId?: string;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.keyword) {
      params.push(`%${options.keyword}%`);
      conditions.push(`original_name ILIKE $${params.length}`);
    }
    if (options.userId) {
      params.push(options.userId);
      conditions.push(`user_id = $${params.length}`);
    }
    if (options.provider) {
      params.push(options.provider);
      conditions.push(`provider = $${params.length}`);
    }
    if (options.storageAccountId) {
      params.push(options.storageAccountId);
      conditions.push(`storage_account_id = $${params.length}`);
    }

    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM files
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params,
    );
    return result.rows[0]?.count || 0;
  },
};

export default FileModel;
