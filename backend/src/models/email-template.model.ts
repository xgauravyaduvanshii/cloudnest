import { QueryResultRow } from 'pg';
import { query } from '../config/database.config';

interface TemplateRow extends QueryResultRow {
  id: string;
  key: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string;
  description: string | null;
  variables: string[] | null;
  is_enabled: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  description: string | null;
  variables: string[];
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateInput {
  key: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  description?: string | null;
  variables?: string[];
  isEnabled?: boolean;
}

const toTemplate = (row: TemplateRow): EmailTemplate => ({
  id: row.id,
  key: row.key,
  name: row.name,
  subject: row.subject,
  htmlBody: row.html_body,
  textBody: row.text_body,
  description: row.description,
  variables: row.variables ?? [],
  isEnabled: !!row.is_enabled,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const EmailTemplateModel = {
  async listAll(): Promise<EmailTemplate[]> {
    const result = await query<TemplateRow>(
      `SELECT * FROM email_templates ORDER BY key ASC`,
    );
    return result.rows.map(toTemplate);
  },

  async getById(id: string): Promise<EmailTemplate | null> {
    const result = await query<TemplateRow>(
      `SELECT * FROM email_templates WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toTemplate(result.rows[0]) : null;
  },

  async getByKey(key: string): Promise<EmailTemplate | null> {
    const result = await query<TemplateRow>(
      `SELECT * FROM email_templates WHERE key = $1`,
      [key],
    );
    return result.rows[0] ? toTemplate(result.rows[0]) : null;
  },

  async create(data: TemplateInput): Promise<EmailTemplate> {
    const result = await query<TemplateRow>(
      `INSERT INTO email_templates (
         key, name, subject, html_body, text_body, description, variables, is_enabled
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE))
       RETURNING *`,
      [
        data.key,
        data.name,
        data.subject,
        data.htmlBody,
        data.textBody,
        data.description ?? null,
        data.variables ?? [],
        data.isEnabled ?? null,
      ],
    );
    return toTemplate(result.rows[0]);
  },

  async update(id: string, data: Partial<TemplateInput>): Promise<EmailTemplate | null> {
    const result = await query<TemplateRow>(
      `UPDATE email_templates SET
         key = COALESCE($2, key),
         name = COALESCE($3, name),
         subject = COALESCE($4, subject),
         html_body = COALESCE($5, html_body),
         text_body = COALESCE($6, text_body),
         description = CASE WHEN $7::text IS NULL THEN description ELSE $7 END,
         variables = COALESCE($8, variables),
         is_enabled = COALESCE($9, is_enabled),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.key ?? null,
        data.name ?? null,
        data.subject ?? null,
        data.htmlBody ?? null,
        data.textBody ?? null,
        data.description ?? null,
        data.variables ?? null,
        data.isEnabled ?? null,
      ],
    );
    return result.rows[0] ? toTemplate(result.rows[0]) : null;
  },

  async setEnabled(id: string, isEnabled: boolean): Promise<EmailTemplate | null> {
    const result = await query<TemplateRow>(
      `UPDATE email_templates SET is_enabled = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, isEnabled],
    );
    return result.rows[0] ? toTemplate(result.rows[0]) : null;
  },

  async remove(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM email_templates WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },
};

export default EmailTemplateModel;
