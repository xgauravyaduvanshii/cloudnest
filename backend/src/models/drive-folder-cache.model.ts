import { QueryResultRow } from 'pg';
import { pool, query } from '../config/database.config';

interface DriveFolderCacheRow extends QueryResultRow {
  storage_account_id: string;
  parent_folder_id: string;
  name_lower: string;
  drive_folder_id: string;
}

export interface DriveFolderCacheDocument {
  storageAccountId: string;
  parentFolderId: string;
  nameLower: string;
  driveFolderId: string;
}

const toDocument = (row: DriveFolderCacheRow): DriveFolderCacheDocument => ({
  storageAccountId: row.storage_account_id,
  parentFolderId: row.parent_folder_id,
  nameLower: row.name_lower,
  driveFolderId: row.drive_folder_id,
});

/**
 * Deterministic 32-bit signed hash used as a Postgres advisory-lock key.
 * Collisions only cause brief extra serialization (folder creation stays
 * idempotent via upsert), never correctness issues.
 */
const hashToInt = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
};

const DriveFolderCacheModel = {
  async find(
    storageAccountId: string,
    parentFolderId: string,
    nameLower: string,
  ): Promise<DriveFolderCacheDocument | null> {
    const result = await query<DriveFolderCacheRow>(
      `SELECT storage_account_id, parent_folder_id, name_lower, drive_folder_id
       FROM drive_folder_cache
       WHERE storage_account_id = $1 AND parent_folder_id = $2 AND name_lower = $3`,
      [storageAccountId, parentFolderId, nameLower],
    );
    return result.rows[0] ? toDocument(result.rows[0]) : null;
  },

  async upsert(
    storageAccountId: string,
    parentFolderId: string,
    nameLower: string,
    driveFolderId: string,
  ): Promise<void> {
    await query(
      `INSERT INTO drive_folder_cache (
        storage_account_id, parent_folder_id, name_lower, drive_folder_id
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (storage_account_id, parent_folder_id, name_lower)
      DO UPDATE SET drive_folder_id = EXCLUDED.drive_folder_id`,
      [storageAccountId, parentFolderId, nameLower, driveFolderId],
    );
  },

  /**
   * Race-safe folder resolution. Checks the cache, and on a miss serializes
   * creation for the (account, parent, name) key with an advisory lock so
   * concurrent workers never create duplicate Drive folders of the same name.
   * `createRemote` performs the actual list-then-create Drive API call.
   */
  async ensure(
    opts: {
      storageAccountId: string;
      parentFolderId: string;
      name: string;
      createRemote: () => Promise<string>;
    },
  ): Promise<string> {
    const nameLower = opts.name.toLowerCase();
    const cached = await this.find(opts.storageAccountId, opts.parentFolderId, nameLower);
    if (cached) return cached.driveFolderId;

    const lockKey = hashToInt(
      `${opts.storageAccountId}|${opts.parentFolderId}|${nameLower}`,
    );
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock($1)', [lockKey]);
      try {
        // Re-check after acquiring the lock; another worker may have created it.
        const refreshed = await client.query<DriveFolderCacheRow>(
          `SELECT storage_account_id, parent_folder_id, name_lower, drive_folder_id
           FROM drive_folder_cache
           WHERE storage_account_id = $1 AND parent_folder_id = $2 AND name_lower = $3`,
          [opts.storageAccountId, opts.parentFolderId, nameLower],
        );
        if (refreshed.rowCount && refreshed.rows[0]) {
          return toDocument(refreshed.rows[0]).driveFolderId;
        }

        const driveFolderId = await opts.createRemote();
        await this.upsert(
          opts.storageAccountId,
          opts.parentFolderId,
          nameLower,
          driveFolderId,
        );
        return driveFolderId;
      } finally {
        await client.query('SELECT pg_advisory_unlock($1)', [lockKey]);
      }
    } finally {
      client.release();
    }
  },

  async invalidate(storageAccountId: string, driveFolderId: string): Promise<void> {
    await query(
      `DELETE FROM drive_folder_cache
       WHERE storage_account_id = $1 AND drive_folder_id = $2`,
      [storageAccountId, driveFolderId],
    );
  },
};

export default DriveFolderCacheModel;
