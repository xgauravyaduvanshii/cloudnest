import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type NoticeLevel = 'welcome' | 'info' | 'success' | 'warning' | 'maintenance';
export type NoticeAudience = 'ALL' | 'USER' | 'ADMIN';

interface NoticeRow extends QueryResultRow {
  id: string;
  title: string;
  body: string;
  level: NoticeLevel;
  audience: NoticeAudience;
  is_published: boolean;
  is_dismissable: boolean;
  priority: number;
  starts_at: Date | null;
  ends_at: Date | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface NoticeDocument {
  _id: string;
  id: string;
  title: string;
  body: string;
  level: NoticeLevel;
  audience: NoticeAudience;
  isPublished: boolean;
  isDismissable: boolean;
  priority: number;
  startsAt: Date | null;
  endsAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toDocument = (row: NoticeRow): NoticeDocument => ({
  _id: row.id,
  id: row.id,
  title: row.title,
  body: row.body,
  level: row.level,
  audience: row.audience,
  isPublished: !!row.is_published,
  isDismissable: !!row.is_dismissable,
  priority: Number(row.priority ?? 0),
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const NoticeModel = {
  async listAll(): Promise<NoticeDocument[]> {
    const result = await query<NoticeRow>(
      `SELECT * FROM notices ORDER BY is_published DESC, priority DESC, created_at DESC`,
    );
    return result.rows.map(toDocument);
  },

  async findById(id: string): Promise<NoticeDocument | null> {
    const result = await query<NoticeRow>(
      `SELECT * FROM notices WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  /** Published, in-window notices. Dismissal filtering happens in the service. */
  async listPublished(): Promise<NoticeDocument[]> {
    const result = await query<NoticeRow>(
      `SELECT * FROM notices
       WHERE is_published = TRUE
         AND (starts_at IS NULL OR starts_at <= NOW())
         AND (ends_at IS NULL OR ends_at >= NOW())
       ORDER BY priority DESC, created_at DESC`,
    );
    return result.rows.map(toDocument);
  },

  async create(data: {
    title: string;
    body: string;
    level: NoticeLevel;
    audience: NoticeAudience;
    isPublished: boolean;
    isDismissable: boolean;
    priority: number;
    startsAt?: Date | null;
    endsAt?: Date | null;
    createdBy?: string | null;
  }): Promise<NoticeDocument> {
    const result = await query<NoticeRow>(
      `INSERT INTO notices (
         title, body, level, audience, is_published, is_dismissable,
         priority, starts_at, ends_at, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.title,
        data.body,
        data.level,
        data.audience,
        data.isPublished,
        data.isDismissable,
        data.priority,
        data.startsAt ?? null,
        data.endsAt ?? null,
        data.createdBy ?? null,
      ],
    );
    return toDocument(result.rows[0]);
  },

  async update(
    id: string,
    data: Partial<{
      title: string;
      body: string;
      level: NoticeLevel;
      audience: NoticeAudience;
      isPublished: boolean;
      isDismissable: boolean;
      priority: number;
      startsAt: Date | null;
      endsAt: Date | null;
    }>,
  ): Promise<NoticeDocument | null> {
    const sets: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, unknown> = {
      title: data.title,
      body: data.body,
      level: data.level,
      audience: data.audience,
      is_published: data.isPublished,
      is_dismissable: data.isDismissable,
      priority: data.priority,
      starts_at: data.startsAt,
      ends_at: data.endsAt,
    };
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) {
        params.push(val);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (!sets.length) return this.findById(id);
    params.push(id);
    const result = await query<NoticeRow>(
      `UPDATE notices SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  async delete(id: string): Promise<boolean> {
    await query(`DELETE FROM notice_dismissals WHERE notice_id = $1`, [id]);
    const result = await query(`DELETE FROM notices WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  // ---- Dismissals --------------------------------------------------------------
  async listDismissedIdsForUser(userId: string): Promise<string[]> {
    const result = await query<{ notice_id: string }>(
      `SELECT notice_id FROM notice_dismissals WHERE user_id = $1`,
      [userId],
    );
    return result.rows.map((r) => r.notice_id);
  },

  async dismiss(userId: string, noticeId: string): Promise<void> {
    await query(
      `INSERT INTO notice_dismissals (user_id, notice_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, notice_id) DO NOTHING`,
      [userId, noticeId],
    );
  },

  async undismiss(userId: string, noticeId: string): Promise<void> {
    await query(
      `DELETE FROM notice_dismissals WHERE user_id = $1 AND notice_id = $2`,
      [userId, noticeId],
    );
  },
};

export default NoticeModel;
