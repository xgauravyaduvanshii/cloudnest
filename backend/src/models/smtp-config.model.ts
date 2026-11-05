import { QueryResultRow } from 'pg';
import { query, withTransaction } from '../config/database.config';
import { decryptText, encryptText } from '../utils/crypto';

interface SmtpRow extends QueryResultRow {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  encrypted_password: string | null;
  from_name: string | null;
  from_address: string;
  reply_to: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Internal, decrypted view used only server-side to build the transport. */
export interface SmtpConfigRaw {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  password: string | null;
  fromName: string | null;
  fromAddress: string;
  replyTo: string | null;
}

/** Public view safe to return to the admin client (never includes the password). */
export interface SmtpConfigPublic {
  id: string;
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username: string | null;
  hasPassword: boolean;
  maskedPassword: string | null;
  fromName: string | null;
  fromAddress: string;
  replyTo: string | null;
  isActive: boolean;
  updatedAt: Date;
}

const mask = (value: string | null) =>
  value ? `${value.slice(0, 2)}...${value.slice(-2)}` : null;

const toRaw = (row: SmtpRow): SmtpConfigRaw => ({
  id: row.id,
  name: row.name,
  host: row.host,
  port: row.port,
  secure: !!row.secure,
  username: row.username,
  password: row.encrypted_password ? decryptText(row.encrypted_password) : null,
  fromName: row.from_name,
  fromAddress: row.from_address,
  replyTo: row.reply_to,
});

const toPublic = (row: SmtpRow): SmtpConfigPublic => {
  const password = row.encrypted_password
    ? decryptText(row.encrypted_password)
    : null;
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    secure: !!row.secure,
    username: row.username,
    hasPassword: !!password,
    maskedPassword: mask(password),
    fromName: row.from_name,
    fromAddress: row.from_address,
    replyTo: row.reply_to,
    isActive: !!row.is_active,
    updatedAt: row.updated_at,
  };
};

export interface SmtpInput {
  name: string;
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  /** undefined = leave stored password unchanged; null/'' = clear; string = set. */
  password?: string | null;
  fromName?: string | null;
  fromAddress: string;
  replyTo?: string | null;
}

const SmtpConfigModel = {
  async listPublic(): Promise<SmtpConfigPublic[]> {
    const result = await query<SmtpRow>(
      `SELECT * FROM smtp_configurations ORDER BY is_active DESC, created_at ASC`,
    );
    return result.rows.map(toPublic);
  },

  async getPublicById(id: string): Promise<SmtpConfigPublic | null> {
    const result = await query<SmtpRow>(
      `SELECT * FROM smtp_configurations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toPublic(result.rows[0]) : null;
  },

  async getRawById(id: string): Promise<SmtpConfigRaw | null> {
    const result = await query<SmtpRow>(
      `SELECT * FROM smtp_configurations WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toRaw(result.rows[0]) : null;
  },

  async getActiveRaw(): Promise<SmtpConfigRaw | null> {
    const result = await query<SmtpRow>(
      `SELECT * FROM smtp_configurations WHERE is_active = TRUE LIMIT 1`,
    );
    return result.rows[0] ? toRaw(result.rows[0]) : null;
  },

  async create(data: SmtpInput, createdBy?: string | null): Promise<SmtpConfigPublic> {
    const encrypted =
      data.password === undefined || data.password === null || data.password === ''
        ? null
        : encryptText(data.password);
    const result = await query<SmtpRow>(
      `INSERT INTO smtp_configurations (
         name, host, port, secure, username, encrypted_password,
         from_name, from_address, reply_to, is_active, created_by
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE, $10)
       RETURNING *`,
      [
        data.name,
        data.host,
        data.port,
        data.secure,
        data.username ?? null,
        encrypted,
        data.fromName ?? null,
        data.fromAddress,
        data.replyTo ?? null,
        createdBy ?? null,
      ],
    );
    return toPublic(result.rows[0]);
  },

  async update(id: string, data: Partial<SmtpInput>): Promise<SmtpConfigPublic | null> {
    // Password handling: undefined -> keep (COALESCE), '' -> clear, else re-encrypt.
    let passwordParam: string | null | undefined;
    if (data.password === undefined) passwordParam = null; // sentinel meaning "keep"
    else if (data.password === null || data.password === '') passwordParam = ''; // clear
    else passwordParam = encryptText(data.password);

    const result = await query<SmtpRow>(
      `UPDATE smtp_configurations SET
         name = COALESCE($2, name),
         host = COALESCE($3, host),
         port = COALESCE($4, port),
         secure = COALESCE($5, secure),
         username = COALESCE($6, username),
         encrypted_password = CASE
           WHEN $7::text IS NULL THEN encrypted_password
           WHEN $7 = '' THEN NULL
           ELSE $7 END,
         from_name = COALESCE($8, from_name),
         from_address = COALESCE($9, from_address),
         reply_to = COALESCE($10, reply_to),
         updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        id,
        data.name ?? null,
        data.host ?? null,
        data.port ?? null,
        data.secure ?? null,
        data.username ?? null,
        passwordParam ?? null,
        data.fromName ?? null,
        data.fromAddress ?? null,
        data.replyTo ?? null,
      ],
    );
    return result.rows[0] ? toPublic(result.rows[0]) : null;
  },

  /** Make exactly one configuration active; deactivate the rest. */
  async setActive(id: string): Promise<SmtpConfigPublic | null> {
    return withTransaction(async (client) => {
      await client.query(
        `UPDATE smtp_configurations SET is_active = FALSE WHERE is_active = TRUE`,
      );
      const result = await client.query<SmtpRow>(
        `UPDATE smtp_configurations SET is_active = TRUE, updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      return result.rows[0] ? toPublic(result.rows[0]) : null;
    });
  },

  async remove(id: string): Promise<boolean> {
    const result = await query(`DELETE FROM smtp_configurations WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  },
};

export default SmtpConfigModel;
