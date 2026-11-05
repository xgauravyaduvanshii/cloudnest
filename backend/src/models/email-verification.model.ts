import { QueryResultRow } from 'pg';
import { query, withTransaction } from '../config/database.config';

export type VerificationPurpose =
  | 'signup_otp'
  | 'magic_link'
  | 'password_reset';

interface VerificationRow extends QueryResultRow {
  id: string;
  user_id: string;
  email: string;
  purpose: VerificationPurpose;
  code_hash: string | null;
  token_hash: string | null;
  expires_at: Date;
  consumed_at: Date | null;
  attempts: number;
  created_at: Date;
}

export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  purpose: VerificationPurpose;
  codeHash: string | null;
  tokenHash: string | null;
  expiresAt: Date;
  attempts: number;
}

const toRecord = (row: VerificationRow): EmailVerification => ({
  id: row.id,
  userId: row.user_id,
  email: row.email,
  purpose: row.purpose,
  codeHash: row.code_hash,
  tokenHash: row.token_hash,
  expiresAt: row.expires_at,
  attempts: row.attempts,
});

const EmailVerificationModel = {
  /**
   * Create a verification, first invalidating any active (unconsumed) ones for
   * the same user + purpose so only the latest code/link is usable.
   */
  async create(data: {
    userId: string;
    email: string;
    purpose: VerificationPurpose;
    codeHash?: string | null;
    tokenHash?: string | null;
    expiresAt: Date;
  }): Promise<string> {
    return withTransaction(async (client) => {
      await client.query(
        `UPDATE email_verifications SET consumed_at = NOW()
         WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL`,
        [data.userId, data.purpose],
      );
      const result = await client.query<VerificationRow>(
        `INSERT INTO email_verifications (
           user_id, email, purpose, code_hash, token_hash, expires_at
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          data.userId,
          data.email,
          data.purpose,
          data.codeHash ?? null,
          data.tokenHash ?? null,
          data.expiresAt,
        ],
      );
      return result.rows[0].id;
    });
  },

  /** Latest active (unconsumed, unexpired) verification for an email + purpose. */
  async findActiveByEmailPurpose(
    email: string,
    purpose: VerificationPurpose,
  ): Promise<EmailVerification | null> {
    const result = await query<VerificationRow>(
      `SELECT * FROM email_verifications
       WHERE LOWER(email) = LOWER($1)
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [email, purpose],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  },

  /** Active verification matching a hashed token (magic link / password reset). */
  async findActiveByTokenHash(
    tokenHash: string,
    purpose: VerificationPurpose,
  ): Promise<EmailVerification | null> {
    const result = await query<VerificationRow>(
      `SELECT * FROM email_verifications
       WHERE token_hash = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash, purpose],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  },

  /** Active verification for a user + purpose (used to check pending state). */
  async findActiveForUser(
    userId: string,
    purpose: VerificationPurpose,
  ): Promise<EmailVerification | null> {
    const result = await query<VerificationRow>(
      `SELECT * FROM email_verifications
       WHERE user_id = $1
         AND purpose = $2
         AND consumed_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, purpose],
    );
    return result.rows[0] ? toRecord(result.rows[0]) : null;
  },

  async incrementAttempts(id: string): Promise<void> {
    await query(
      `UPDATE email_verifications SET attempts = attempts + 1 WHERE id = $1`,
      [id],
    );
  },

  async consume(id: string): Promise<void> {
    await query(
      `UPDATE email_verifications SET consumed_at = NOW() WHERE id = $1`,
      [id],
    );
  },
};

export default EmailVerificationModel;
