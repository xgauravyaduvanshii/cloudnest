import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

interface ApiKeyRow extends QueryResultRow {
  id: string;
  user_id: string;
  name: string;
  display_key: string;
  hashed_key: string;
  created_at: Date;
  updated_at: Date;
  last_used_at: Date | null;
}

export interface ApiKeyDocument {
  _id: string;
  id: string;
  userId: string;
  name: string;
  displayKey: string;
  hashedKey?: string;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

const toApiKeyDocument = (
  row: ApiKeyRow,
  includeHashedKey = false,
): ApiKeyDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  name: row.name,
  displayKey: row.display_key,
  hashedKey: includeHashedKey ? row.hashed_key : undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastUsedAt: row.last_used_at,
});

const ApiKeyModel = {
  async create(data: {
    userId: string;
    name: string;
    displayKey: string;
    hashedKey: string;
  }) {
    const result = await query<ApiKeyRow>(
      `INSERT INTO api_keys (user_id, name, display_key, hashed_key)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.name, data.displayKey, data.hashedKey],
    );
    return toApiKeyDocument(result.rows[0], true);
  },

  async findByHashedKey(hashedKey: string) {
    const result = await query<ApiKeyRow>(
      `SELECT *
       FROM api_keys
       WHERE hashed_key = $1`,
      [hashedKey],
    );
    return result.rows[0] ? toApiKeyDocument(result.rows[0], true) : null;
  },

  async findAllByUser(
    userId: string,
    pagination: { limit: number; offset: number },
  ) {
    const result = await query<ApiKeyRow>(
      `SELECT *
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2
       OFFSET $3`,
      [userId, pagination.limit, pagination.offset],
    );
    return result.rows.map((row) => toApiKeyDocument(row));
  },

  async findAllAdmin(pagination: { limit: number; offset: number }) {
    const result = await query<ApiKeyRow & { user_email: string; user_name: string }>(
      `SELECT
         ak.*,
         u.email AS user_email,
         u.name AS user_name
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       ORDER BY ak.created_at DESC
       LIMIT $1
       OFFSET $2`,
      [pagination.limit, pagination.offset],
    );
    return result.rows.map((row) => ({
      ...toApiKeyDocument(row),
      userEmail: row.user_email,
      userName: row.user_name,
    }));
  },

  async countAllAdmin() {
    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM api_keys`,
    );
    return result.rows[0]?.count || 0;
  },

  async countByUser(userId: string) {
    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM api_keys
       WHERE user_id = $1`,
      [userId],
    );
    return result.rows[0]?.count || 0;
  },

  async deleteByIdForUser(userId: string, apiKeyId: string) {
    const result = await query(
      `DELETE FROM api_keys
       WHERE id = $1
       AND user_id = $2`,
      [apiKeyId, userId],
    );
    return result.rowCount || 0;
  },

  async deleteById(apiKeyId: string) {
    const result = await query(
      `DELETE FROM api_keys
       WHERE id = $1`,
      [apiKeyId],
    );
    return result.rowCount || 0;
  },

  async updateLastUsedAt(hashedKey: string): Promise<void> {
    await query(
      `UPDATE api_keys
       SET last_used_at = NOW()
       WHERE hashed_key = $1`,
      [hashedKey],
    );
  },
};

export default ApiKeyModel;
