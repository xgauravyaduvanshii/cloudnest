import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';

interface CollectionRow extends QueryResultRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  created_at: Date;
  updated_at: Date;
  file_count?: number;
}

export interface CollectionDocument {
  _id: string;
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  fileCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type Queryable = Pick<PoolClient, 'query'>;

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toCollectionDocument = (row: CollectionRow): CollectionDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  name: row.name,
  description: row.description ?? null,
  color: row.color ?? null,
  fileCount: Number(row.file_count ?? 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeName = (name: string) => name.trim().replace(/\s+/g, ' ');

const CollectionModel = {
  async create(data: {
    userId: string;
    name: string;
    description?: string | null;
    color?: string | null;
  }) {
    const result = await query<CollectionRow>(
      `INSERT INTO collections (user_id, name, description, color)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        data.userId,
        normalizeName(data.name),
        data.description ?? null,
        data.color ?? null,
      ],
    );
    return toCollectionDocument(result.rows[0]);
  },

  async findById(collectionId: string) {
    const result = await query<CollectionRow>(
      `SELECT c.*, (
         SELECT COUNT(*)::int FROM collection_items ci WHERE ci.collection_id = c.id
       ) AS file_count
       FROM collections c WHERE c.id = $1`,
      [collectionId],
    );
    return result.rows[0] ? toCollectionDocument(result.rows[0]) : null;
  },

  async findByIdForUser(collectionId: string, userId: string) {
    const result = await query<CollectionRow>(
      `SELECT c.*, (
         SELECT COUNT(*)::int FROM collection_items ci WHERE ci.collection_id = c.id
       ) AS file_count
       FROM collections c WHERE c.id = $1 AND c.user_id = $2`,
      [collectionId, userId],
    );
    return result.rows[0] ? toCollectionDocument(result.rows[0]) : null;
  },

  async findAllForUser(userId: string) {
    const result = await query<CollectionRow>(
      `SELECT c.*, (
         SELECT COUNT(*)::int FROM collection_items ci WHERE ci.collection_id = c.id
       ) AS file_count
       FROM collections c
       WHERE c.user_id = $1
       ORDER BY c.created_at DESC`,
      [userId],
    );
    return result.rows.map(toCollectionDocument);
  },

  async findByNameForUser(userId: string, name: string) {
    const result = await query<CollectionRow>(
      `SELECT * FROM collections
       WHERE user_id = $1 AND LOWER(name) = LOWER($2)
       LIMIT 1`,
      [userId, normalizeName(name)],
    );
    return result.rows[0] ? toCollectionDocument(result.rows[0]) : null;
  },

  async update(
    collectionId: string,
    userId: string,
    data: { name?: string; description?: string | null; color?: string | null },
  ) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (data.name !== undefined) {
      params.push(normalizeName(data.name));
      sets.push(`name = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description);
      sets.push(`description = $${params.length}`);
    }
    if (data.color !== undefined) {
      params.push(data.color);
      sets.push(`color = $${params.length}`);
    }
    if (!sets.length) {
      return this.findByIdForUser(collectionId, userId);
    }
    params.push(collectionId, userId);
    const result = await query<CollectionRow>(
      `UPDATE collections SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING *`,
      params,
    );
    if (!result.rows[0]) return null;
    return this.findByIdForUser(collectionId, userId);
  },

  async deleteByIdForUser(collectionId: string, userId: string, client?: Queryable) {
    const result = await runQuery(
      `DELETE FROM collections WHERE id = $1 AND user_id = $2`,
      [collectionId, userId],
      client,
    );
    return result.rowCount || 0;
  },

  // ---- Items (many-to-many membership; never moves/copies the underlying file) --
  async addItems(collectionId: string, fileIds: string[]) {
    if (!fileIds.length) return 0;
    const result = await query(
      `INSERT INTO collection_items (collection_id, file_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT (collection_id, file_id) DO NOTHING`,
      [collectionId, fileIds],
    );
    return result.rowCount || 0;
  },

  async removeItems(collectionId: string, fileIds: string[]) {
    if (!fileIds.length) return 0;
    const result = await query(
      `DELETE FROM collection_items
       WHERE collection_id = $1 AND file_id = ANY($2::uuid[])`,
      [collectionId, fileIds],
    );
    return result.rowCount || 0;
  },

  async listCollectionsForFile(fileId: string, userId: string) {
    const result = await query<CollectionRow>(
      `SELECT c.* FROM collections c
       JOIN collection_items ci ON ci.collection_id = c.id
       WHERE ci.file_id = $1 AND c.user_id = $2
       ORDER BY c.name ASC`,
      [fileId, userId],
    );
    return result.rows.map(toCollectionDocument);
  },

  async findItemIds(collectionId: string) {
    const result = await query<{ file_id: string }>(
      `SELECT file_id FROM collection_items WHERE collection_id = $1`,
      [collectionId],
    );
    return result.rows.map((r) => r.file_id);
  },

  async deleteItemsForFileIds(fileIds: string[], client?: Queryable) {
    if (!fileIds.length) return 0;
    const result = await runQuery(
      `DELETE FROM collection_items WHERE file_id = ANY($1::uuid[])`,
      [fileIds],
      client,
    );
    return result.rowCount || 0;
  },
};

export default CollectionModel;
