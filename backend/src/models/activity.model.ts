import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type ActivityActorType = 'user' | 'system' | 'api';

interface ActivityRow extends QueryResultRow {
  id: string;
  user_id: string;
  actor_type: ActivityActorType;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface ActivityDocument {
  _id: string;
  id: string;
  userId: string;
  actorType: ActivityActorType;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

interface ShareAuditRow extends QueryResultRow {
  id: string;
  share_id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
}

export interface ShareAuditDocument {
  id: string;
  shareId: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

const toActivityDocument = (row: ActivityRow): ActivityDocument => ({
  _id: row.id,
  id: row.id,
  userId: row.user_id,
  actorType: row.actor_type,
  action: row.action,
  entityType: row.entity_type ?? null,
  entityId: row.entity_id ?? null,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});

const toShareAuditDocument = (row: ShareAuditRow): ShareAuditDocument => ({
  id: row.id,
  shareId: row.share_id,
  action: row.action,
  ipAddress: row.ip_address ?? null,
  userAgent: row.user_agent ?? null,
  metadata: row.metadata || {},
  createdAt: row.created_at,
});

const ActivityModel = {
  async record(data: {
    userId: string;
    action: string;
    actorType?: ActivityActorType;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const result = await query<ActivityRow>(
      `INSERT INTO activity_events (user_id, actor_type, action, entity_type, entity_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        data.userId,
        data.actorType ?? 'user',
        data.action,
        data.entityType ?? null,
        data.entityId ?? null,
        JSON.stringify(data.metadata ?? {}),
      ],
    );
    return result.rows[0] ? toActivityDocument(result.rows[0]) : null;
  },

  async listForUser(
    userId: string,
    pagination: { limit: number; offset: number },
    filter?: { action?: string; entityType?: string },
  ) {
    const clauses = ['user_id = $1'];
    const params: unknown[] = [userId];
    if (filter?.action) {
      params.push(filter.action);
      clauses.push(`action = $${params.length}`);
    }
    if (filter?.entityType) {
      params.push(filter.entityType);
      clauses.push(`entity_type = $${params.length}`);
    }
    params.push(pagination.limit, pagination.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;
    const result = await query<ActivityRow>(
      `SELECT * FROM activity_events
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${limitParam} OFFSET $${offsetParam}`,
      params,
    );
    return result.rows.map(toActivityDocument);
  },

  async countForUser(userId: string, filter?: { action?: string }) {
    const clauses = ['user_id = $1'];
    const params: unknown[] = [userId];
    if (filter?.action) {
      params.push(filter.action);
      clauses.push(`action = $${params.length}`);
    }
    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM activity_events WHERE ${clauses.join(' AND ')}`,
      params,
    );
    return result.rows[0]?.count || 0;
  },

  async recordShareAudit(data: {
    shareId: string;
    action: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const result = await query<ShareAuditRow>(
      `INSERT INTO share_audit (share_id, action, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.shareId,
        data.action,
        data.ipAddress ?? null,
        data.userAgent ?? null,
        JSON.stringify(data.metadata ?? {}),
      ],
    );
    return result.rows[0] ? toShareAuditDocument(result.rows[0]) : null;
  },

  async listShareAudit(shareId: string, limit = 100) {
    const result = await query<ShareAuditRow>(
      `SELECT * FROM share_audit WHERE share_id = $1
       ORDER BY created_at DESC LIMIT $2`,
      [shareId, limit],
    );
    return result.rows.map(toShareAuditDocument);
  },
};

export default ActivityModel;
