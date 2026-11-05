import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

export type ContactStatus =
  | 'NEW'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'SOLVED'
  | 'REJECTED';

interface ContactRequestRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  user_id: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  admin_note: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ContactRequestDocument {
  _id: string;
  id: string;
  name: string;
  email: string;
  userId: string | null;
  subject: string | null;
  message: string;
  status: ContactStatus;
  adminNote: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const toDocument = (row: ContactRequestRow): ContactRequestDocument => ({
  _id: row.id,
  id: row.id,
  name: row.name,
  email: row.email,
  userId: row.user_id,
  subject: row.subject ?? null,
  message: row.message,
  status: row.status,
  adminNote: row.admin_note ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const ContactRequestModel = {
  async create(data: {
    name: string;
    email: string;
    userId?: string | null;
    subject?: string | null;
    message: string;
  }): Promise<ContactRequestDocument> {
    const result = await query<ContactRequestRow>(
      `INSERT INTO contact_requests (name, email, user_id, subject, message)
       VALUES ($1, LOWER($2), $3, $4, $5)
       RETURNING *`,
      [
        data.name,
        data.email,
        data.userId ?? null,
        data.subject || null,
        data.message,
      ],
    );
    return toDocument(result.rows[0]);
  },

  async findById(id: string): Promise<ContactRequestDocument | null> {
    const result = await query<ContactRequestRow>(
      `SELECT * FROM contact_requests WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  /** Admin list with optional status + keyword filters and offset pagination. */
  async listAll(options: {
    status?: ContactStatus;
    keyword?: string;
    limit: number;
    offset: number;
  }): Promise<{ requests: ContactRequestDocument[]; totalCount: number }> {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (options.status) {
      params.push(options.status);
      clauses.push(`status = $${params.length}`);
    }
    if (options.keyword?.trim()) {
      params.push(`%${options.keyword.trim().toLowerCase()}%`);
      const p = params.length;
      clauses.push(
        `(LOWER(name) LIKE $${p} OR LOWER(email) LIKE $${p} OR LOWER(COALESCE(subject, '')) LIKE $${p})`,
      );
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const countResult = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM contact_requests ${where}`,
      params,
    );
    const totalCount = Number(countResult.rows[0]?.count || 0);

    params.push(options.limit, options.offset);
    const listResult = await query<ContactRequestRow>(
      `SELECT * FROM contact_requests ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { requests: listResult.rows.map(toDocument), totalCount };
  },

  /** Everything a signed-in user should see: their linked submissions + any by email. */
  async listForUser(userId: string, email: string): Promise<ContactRequestDocument[]> {
    const result = await query<ContactRequestRow>(
      `SELECT * FROM contact_requests
       WHERE user_id = $1 OR LOWER(email) = LOWER($2)
       ORDER BY created_at DESC`,
      [userId, email],
    );
    return result.rows.map(toDocument);
  },

  async setStatus(
    id: string,
    status: ContactStatus,
    adminNote?: string | null,
  ): Promise<ContactRequestDocument | null> {
    const result = await query<ContactRequestRow>(
      `UPDATE contact_requests
       SET status = $2,
           admin_note = COALESCE($3, admin_note)
       WHERE id = $1
       RETURNING *`,
      [id, status, adminNote ?? null],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  async delete(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM contact_requests WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};

export default ContactRequestModel;
