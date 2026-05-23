import { PoolClient, QueryResultRow } from 'pg';
import { query } from '../config/database.config';
import { hashValue, compareValue } from '../utils/bcrypt';

interface UserRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  password: string;
  profile_picture: string | null;
  role: UserRole;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

type Queryable = Pick<PoolClient, 'query'>;

export interface UserDocument {
  _id: string;
  id: string;
  name: string;
  email: string;
  password: string;
  profilePicture: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(value: string): Promise<boolean>;
  omitPassword(): PublicUserDocument;
}

export type UserRole = 'USER' | 'ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';

export type PublicUserDocument = Omit<
  UserDocument,
  'password' | 'comparePassword' | 'omitPassword'
>;

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toUserDocument = (row: UserRow): UserDocument => ({
  _id: row.id,
  id: row.id,
  name: row.name,
  email: row.email,
  password: row.password,
  profilePicture: row.profile_picture,
  role: row.role,
  status: row.status,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  comparePassword(value: string) {
    return compareValue(value, this.password);
  },
  omitPassword() {
    const { password, comparePassword, omitPassword, ...user } = this;
    return user;
  },
});

const UserModel = {
  async findById(userId: string, client?: Queryable) {
    const result = await runQuery<UserRow>(
      `SELECT *
       FROM users
       WHERE id = $1`,
      [userId],
      client,
    );
    return result.rows[0] ? toUserDocument(result.rows[0]) : null;
  },

  async findByEmail(email: string, client?: Queryable) {
    const result = await runQuery<UserRow>(
      `SELECT *
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [email],
      client,
    );
    return result.rows[0] ? toUserDocument(result.rows[0]) : null;
  },

  async create(
    data: {
      name: string;
      email: string;
      password: string;
      profilePicture?: string | null;
      role?: UserRole;
    },
    client?: Queryable,
  ) {
    const hashedPassword = await hashValue(data.password);
    const result = await runQuery<UserRow>(
      `INSERT INTO users (name, email, password, profile_picture, role)
       VALUES ($1, LOWER($2), $3, $4, $5)
       RETURNING *`,
      [
        data.name.trim(),
        data.email.trim(),
        hashedPassword,
        data.profilePicture || null,
        data.role || 'USER',
      ],
      client,
    );
    return toUserDocument(result.rows[0]);
  },

  async findAll(options: {
    keyword?: string;
    limit: number;
    offset: number;
  }) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (options.keyword) {
      params.push(`%${options.keyword}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    params.push(options.limit, options.offset);
    const limitParam = params.length - 1;
    const offsetParam = params.length;

    const result = await query<UserRow>(
      `SELECT *
       FROM users
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY created_at DESC
       LIMIT $${limitParam}
       OFFSET $${offsetParam}`,
      params,
    );

    return result.rows.map(toUserDocument);
  },

  async countAll(keyword?: string) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (keyword) {
      params.push(`%${keyword}%`);
      conditions.push(`(name ILIKE $${params.length} OR email ILIKE $${params.length})`);
    }

    const result = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM users
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}`,
      params,
    );
    return result.rows[0]?.count || 0;
  },

  async updateAdminFields(
    userId: string,
    data: {
      role?: UserRole;
      status?: UserStatus;
      storageQuota?: number;
    },
    client?: Queryable,
  ) {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.role) {
      params.push(data.role);
      updates.push(`role = $${params.length}`);
    }

    if (data.status) {
      params.push(data.status);
      updates.push(`status = $${params.length}`);
    }

    if (!updates.length) {
      return this.findById(userId, client);
    }

    params.push(userId);

    const result = await runQuery<UserRow>(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params,
      client,
    );
    return result.rows[0] ? toUserDocument(result.rows[0]) : null;
  },
};

export default UserModel;
