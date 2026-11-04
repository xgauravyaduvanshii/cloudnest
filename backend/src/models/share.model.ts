import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type ShareResourceType = 'file' | 'folder' | 'collection';
export type ShareVisibility = 'PUBLIC' | 'PRIVATE';
export type SharePermission = 'view' | 'download' | 'upload' | 'edit';

interface ShareRow extends QueryResultRow {
  id: string;
  user_id: string;
  resource_type: ShareResourceType;
  resource_id: string;
  token: string;
  visibility: ShareVisibility;
  permission: SharePermission;
  password_hash: string | null;
  expires_at: Date | null;
  max_downloads: number | null;
  download_count: number;
  view_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ShareDocument {
  _id: string;
  id: string;
  userId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  token: string;
  visibility: ShareVisibility;
  permission: SharePermission;
  hasPassword: boolean;
  expiresAt: Date | null;
  maxDownloads: number | null;
  downloadCount: number;
  viewCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Internal only — stripped before returning to clients.
  passwordHash?: string | null;
}

type Queryable = Pick<PoolClient, 'query'>;

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toShareDocument = (row: ShareRow): ShareDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  token: row.token,
  visibility: row.visibility,
  permission: row.permission,
  hasPassword: !!row.password_hash,
  expiresAt: row.expires_at,
  maxDownloads: row.max_downloads,
  downloadCount: row.download_count,
  viewCount: row.view_count,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  passwordHash: row.password_hash,
});

const ShareModel = {
  async create(data: {
    userId: string;
    resourceType: ShareResourceType;
    resourceId: string;
    token: string;
    visibility: ShareVisibility;
    permission: SharePermission;
    passwordHash?: string | null;
    expiresAt?: Date | null;
    maxDownloads?: number | null;
  }) {
    const result = await query<ShareRow>(
      `INSERT INTO shares (
        user_id, resource_type, resource_id, token, visibility, permission,
        password_hash, expires_at, max_downloads
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        data.userId,
        data.resourceType,
        data.resourceId,
        data.token,
        data.visibility,
        data.permission,
        data.passwordHash ?? null,
        data.expiresAt ?? null,
        data.maxDownloads ?? null,
      ],
    );
    return toShareDocument(result.rows[0]);
  },

  async findById(shareId: string) {
    const result = await query<ShareRow>(
      `SELECT * FROM shares WHERE id = $1`,
      [shareId],
    );
    return result.rows[0] ? toShareDocument(result.rows[0]) : null;
  },

  async findByIdForUser(shareId: string, userId: string) {
    const result = await query<ShareRow>(
      `SELECT * FROM shares WHERE id = $1 AND user_id = $2`,
      [shareId, userId],
    );
    return result.rows[0] ? toShareDocument(result.rows[0]) : null;
  },

  async findByToken(token: string) {
    const result = await query<ShareRow>(
      `SELECT * FROM shares WHERE token = $1`,
      [token],
    );
    return result.rows[0] ? toShareDocument(result.rows[0]) : null;
  },

  async findAllForUser(userId: string) {
    const result = await query<ShareRow>(
      `SELECT * FROM shares WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toShareDocument);
  },

  async findForResource(
    userId: string,
    resourceType: ShareResourceType,
    resourceId: string,
  ) {
    const result = await query<ShareRow>(
      `SELECT * FROM shares
       WHERE user_id = $1 AND resource_type = $2 AND resource_id = $3
       ORDER BY created_at DESC`,
      [userId, resourceType, resourceId],
    );
    return result.rows.map(toShareDocument);
  },

  async update(
    shareId: string,
    userId: string,
    data: {
      visibility?: ShareVisibility;
      permission?: SharePermission;
      passwordHash?: string | null;
      expiresAt?: Date | null;
      maxDownloads?: number | null;
      isActive?: boolean;
    },
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    const assign = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };
    if (data.visibility !== undefined) assign('visibility', data.visibility);
    if (data.permission !== undefined) assign('permission', data.permission);
    if (data.passwordHash !== undefined)
      assign('password_hash', data.passwordHash);
    if (data.expiresAt !== undefined) assign('expires_at', data.expiresAt);
    if (data.maxDownloads !== undefined) assign('max_downloads', data.maxDownloads);
    if (data.isActive !== undefined) assign('is_active', data.isActive);
    if (!sets.length) return this.findByIdForUser(shareId, userId);
    params.push(shareId, userId);
    const result = await query<ShareRow>(
      `UPDATE shares SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    if (!result.rows[0]) return null;
    return toShareDocument(result.rows[0]);
  },

  async incrementViewCount(shareId: string) {
    const result = await query<ShareRow>(
      `UPDATE shares SET view_count = view_count + 1 WHERE id = $1 RETURNING *`,
      [shareId],
    );
    return result.rows[0] ? toShareDocument(result.rows[0]) : null;
  },

  /**
   * Atomically increment the download count only when the share still has
   * budget (no cap, or below cap). Returns the refreshed share when a slot was
   * consumed, or null when the download limit has been reached.
   */
  async consumeDownloadSlot(shareId: string) {
    const result = await query<ShareRow>(
      `UPDATE shares SET download_count = download_count + 1
       WHERE id = $1
         AND (max_downloads IS NULL OR download_count < max_downloads)
       RETURNING *`,
      [shareId],
    );
    return result.rows[0] ? toShareDocument(result.rows[0]) : null;
  },

  async deleteByIdForUser(shareId: string, userId: string, client?: Queryable) {
    const result = await runQuery(
      `DELETE FROM shares WHERE id = $1 AND user_id = $2`,
      [shareId, userId],
      client,
    );
    return result.rowCount || 0;
  },

  async deleteForResources(resourceType: ShareResourceType, resourceIds: string[]) {
    if (!resourceIds.length) return 0;
    const result = await runQuery(
      `DELETE FROM shares WHERE resource_type = $1 AND resource_id = ANY($2::uuid[])`,
      [resourceType, resourceIds],
    );
    return result.rowCount || 0;
  },
};

export default ShareModel;
