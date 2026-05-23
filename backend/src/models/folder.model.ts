import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';
import { BadRequestException, NotFoundException } from '../utils/app-error';
import { StorageProviderType } from './storage-account.model';

interface FolderRow extends QueryResultRow {
  id: string;
  user_id: string;
  parent_id: string | null;
  provider: StorageProviderType;
  name: string;
  provider_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

type Queryable = Pick<PoolClient, 'query'>;

export interface FolderDocument {
  _id: string;
  id: string;
  userId: string;
  parentId: string | null;
  provider: StorageProviderType;
  name: string;
  providerMetadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const toFolderDocument = (row: FolderRow): FolderDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  parentId: row.parent_id,
  provider: row.provider,
  name: row.name,
  providerMetadata: row.provider_metadata || {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

export const normalizeFolderName = (name: string) => {
  const cleaned = name.trim().replace(/[\\/]+/g, '-').replace(/\s+/g, ' ');
  if (!cleaned) throw new BadRequestException('Folder name is required');
  if (cleaned === '.' || cleaned === '..') {
    throw new BadRequestException('Folder name is not allowed');
  }
  return cleaned.slice(0, 255);
};

const FolderModel = {
  async create(
    data: {
      userId: string;
      parentId?: string | null;
      provider: StorageProviderType;
      name: string;
    },
    client?: Queryable,
  ) {
    const name = normalizeFolderName(data.name);
    const existing = await this.findChildByName(
      data.userId,
      data.parentId || null,
      data.provider,
      name,
      client,
    );
    if (existing) throw new BadRequestException('Folder already exists');

    const result = await runQuery<FolderRow>(
      `INSERT INTO folders (user_id, parent_id, provider, name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.parentId || null, data.provider, name],
      client,
    );
    return toFolderDocument(result.rows[0]);
  },

  async findById(folderId: string, client?: Queryable) {
    const result = await runQuery<FolderRow>(
      `SELECT *
       FROM folders
       WHERE id = $1`,
      [folderId],
      client,
    );
    return result.rows[0] ? toFolderDocument(result.rows[0]) : null;
  },

  async findByIdForUser(
    folderId: string,
    userId: string,
    provider?: StorageProviderType,
    client?: Queryable,
  ) {
    const params: unknown[] = [folderId, userId];
    const providerClause = provider
      ? ` AND provider = $${params.push(provider)}`
      : '';
    const result = await runQuery<FolderRow>(
      `SELECT *
       FROM folders
       WHERE id = $1
         AND user_id = $2
         ${providerClause}`,
      params,
      client,
    );
    return result.rows[0] ? toFolderDocument(result.rows[0]) : null;
  },

  async findChildByName(
    userId: string,
    parentId: string | null,
    provider: StorageProviderType,
    name: string,
    client?: Queryable,
  ) {
    const result = await runQuery<FolderRow>(
      `SELECT *
       FROM folders
       WHERE user_id = $1
         AND provider = $2
         AND ${parentId ? 'parent_id = $3' : 'parent_id IS NULL'}
         AND LOWER(name) = LOWER($${parentId ? 4 : 3})
       LIMIT 1`,
      parentId ? [userId, provider, parentId, name] : [userId, provider, name],
      client,
    );
    return result.rows[0] ? toFolderDocument(result.rows[0]) : null;
  },

  async findChildren(
    userId: string,
    parentId: string | null,
    provider: StorageProviderType,
    keyword?: string,
  ) {
    const params: unknown[] = [userId, provider];
    const clauses = ['user_id = $1', 'provider = $2'];

    if (parentId) {
      params.push(parentId);
      clauses.push(`parent_id = $${params.length}`);
    } else {
      clauses.push('parent_id IS NULL');
    }

    if (keyword) {
      params.push(`%${keyword}%`);
      clauses.push(`name ILIKE $${params.length}`);
    }

    const result = await query<FolderRow>(
      `SELECT *
       FROM folders
       WHERE ${clauses.join(' AND ')}
       ORDER BY name ASC`,
      params,
    );
    return result.rows.map(toFolderDocument);
  },

  async findPath(
    userId: string,
    folderId: string | null,
    provider?: StorageProviderType,
  ) {
    if (!folderId) return [];

    const params: unknown[] = [folderId, userId];
    const providerClause = provider
      ? ` AND provider = $${params.push(provider)}`
      : '';
    const result = await query<FolderRow & { depth: number }>(
      `WITH RECURSIVE folder_path AS (
        SELECT *, 0 AS depth
        FROM folders
        WHERE id = $1
          AND user_id = $2
          ${providerClause}
        UNION ALL
        SELECT parent.*, child.depth + 1 AS depth
        FROM folders parent
        JOIN folder_path child ON child.parent_id = parent.id
      )
      SELECT *
      FROM folder_path
      ORDER BY depth DESC`,
      params,
    );

    return result.rows.map(toFolderDocument);
  },

  async ensurePath(
    userId: string,
    parentId: string | null,
    provider: StorageProviderType,
    parts: string[],
    client?: Queryable,
  ) {
    let currentParentId = parentId;

    if (currentParentId) {
      const parent = await this.findByIdForUser(
        currentParentId,
        userId,
        provider,
        client,
      );
      if (!parent) throw new NotFoundException('Parent folder not found');
    }

    for (const part of parts) {
      const name = normalizeFolderName(part);
      const existing = await this.findChildByName(
        userId,
        currentParentId,
        provider,
        name,
        client,
      );
      if (existing) {
        currentParentId = existing.id;
        continue;
      }

      const created = await this.create(
        {
          userId,
          parentId: currentParentId,
          provider,
          name,
        },
        client,
      );
      currentParentId = created.id;
    }

    return currentParentId;
  },

  async updateProviderMetadata(
    folderId: string,
    accountId: string,
    metadata: Record<string, unknown>,
    client?: Queryable,
  ) {
    const result = await runQuery<FolderRow>(
      `UPDATE folders
       SET provider_metadata = jsonb_set(
         provider_metadata,
         ARRAY[$2],
         $3::jsonb,
         true
       )
       WHERE id = $1
       RETURNING *`,
      [folderId, accountId, JSON.stringify(metadata)],
      client,
    );
    return result.rows[0] ? toFolderDocument(result.rows[0]) : null;
  },

  async hasChildren(
    userId: string,
    folderId: string,
    provider: StorageProviderType,
  ) {
    const result = await query<{ count: number }>(
      `SELECT (
        (SELECT COUNT(*) FROM folders
         WHERE user_id = $1 AND provider = $2 AND parent_id = $3)
        +
        (SELECT COUNT(*) FROM files
         WHERE user_id = $1 AND provider = $2 AND folder_id = $3)
       )::int AS count`,
      [userId, provider, folderId],
    );
    return (result.rows[0]?.count || 0) > 0;
  },

  async moveByIdForUser(
    folderId: string,
    userId: string,
    provider: StorageProviderType,
    parentId: string | null,
    client?: Queryable,
  ) {
    if (folderId === parentId) {
      throw new BadRequestException('Folder cannot be moved into itself');
    }

    if (parentId) {
      const parentPath = await this.findPath(userId, parentId, provider);
      if (parentPath.some((folder) => folder.id === folderId)) {
        throw new BadRequestException('Folder cannot be moved into its child');
      }
    }

    const result = await runQuery<FolderRow>(
      `UPDATE folders
       SET parent_id = $1
       WHERE id = $2
         AND user_id = $3
         AND provider = $4
       RETURNING *`,
      [parentId, folderId, userId, provider],
      client,
    );
    return result.rows[0] ? toFolderDocument(result.rows[0]) : null;
  },

  async deleteByIdForUser(
    folderId: string,
    userId: string,
    provider: StorageProviderType,
    client?: Queryable,
  ) {
    const result = await runQuery(
      `DELETE FROM folders
       WHERE id = $1
         AND user_id = $2
         AND provider = $3`,
      [folderId, userId, provider],
      client,
    );
    return result.rowCount || 0;
  },
};

export default FolderModel;
