import crypto from 'crypto';
import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

interface WebhookRow extends QueryResultRow {
  id: string;
  user_id: string;
  url: string;
  secret: string;
  events: string[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDocument {
  _id: string;
  id: string;
  userId: string;
  url: string;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // secret is intentionally never mapped to the public document.
}

const toDocument = (row: WebhookRow): WebhookDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  url: row.url,
  events: row.events ?? [],
  isActive: !!row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const WebhookModel = {
  generateSecret() {
    return `whsec_${crypto.randomBytes(24).toString('hex')}`;
  },

  async create(data: { userId: string; url: string; secret: string; events: string[] }) {
    const result = await query<WebhookRow>(
      `INSERT INTO webhook_endpoints (user_id, url, secret, events)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [data.userId, data.url, data.secret, data.events],
    );
    return toDocument(result.rows[0]);
  },

  async listForUser(userId: string) {
    const result = await query<WebhookRow>(
      `SELECT * FROM webhook_endpoints WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map(toDocument);
  },

  async findByIdForUser(userId: string, id: string) {
    const result = await query<WebhookRow>(
      `SELECT * FROM webhook_endpoints WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  /** Internal: includes the signing secret for dispatch. */
  async findActiveWithSecretsForEvent(userId: string, event: string) {
    const result = await query<WebhookRow>(
      `SELECT * FROM webhook_endpoints
       WHERE user_id = $1 AND is_active = TRUE AND $2 = ANY(events)`,
      [userId, event],
    );
    return result.rows.map((row) => ({ ...toDocument(row), secret: row.secret }));
  },

  async update(userId: string, id: string, data: { url?: string; events?: string[]; isActive?: boolean }) {
    const result = await query<WebhookRow>(
      `UPDATE webhook_endpoints SET
         url = COALESCE($3, url),
         events = COALESCE($4, events),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId, data.url ?? null, data.events ?? null, data.isActive ?? null],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  async deleteForUser(userId: string, id: string) {
    const result = await query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
  },

  async recordDelivery(data: {
    endpointId: string;
    event: string;
    payload: Record<string, unknown>;
    status: 'delivered' | 'failed';
    responseStatus?: number | null;
    error?: string | null;
  }) {
    await query(
      `INSERT INTO webhook_deliveries (endpoint_id, event, payload, status, attempts, response_status, error, delivered_at)
       VALUES ($1, $2, $3, $4, 1, $5, $6, CASE WHEN $4 = 'delivered' THEN NOW() ELSE NULL END)`,
      [
        data.endpointId,
        data.event,
        JSON.stringify(data.payload),
        data.status,
        data.responseStatus ?? null,
        data.error ?? null,
      ],
    );
  },

  async listDeliveriesForEndpoint(userId: string, endpointId: string, limit = 25) {
    const result = await query<QueryResultRow & { status: string; event: string; created_at: Date; response_status: number | null }>(
      `SELECT d.event, d.status, d.response_status, d.created_at
       FROM webhook_deliveries d
       JOIN webhook_endpoints e ON e.id = d.endpoint_id
       WHERE d.endpoint_id = $1 AND e.user_id = $2
       ORDER BY d.created_at DESC
       LIMIT $3`,
      [endpointId, userId, limit],
    );
    return result.rows.map((r) => ({
      event: r.event,
      status: r.status,
      responseStatus: r.response_status ?? null,
      createdAt: r.created_at,
    }));
  },
};

export default WebhookModel;
