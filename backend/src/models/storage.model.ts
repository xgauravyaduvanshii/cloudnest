import { PoolClient, QueryResultRow } from 'pg';
import FileModel from './file.model';
import { BadRequestException, NotFoundException } from '../utils/app-error';
import { formatBytes } from '../utils/format-byte';
import { ErrorCodeEnum } from '../enums/error-code.enum';
import { query } from '../config/database.config';

export const STORAGE_QUOTA = 2 * 1024 * 1024 * 1024; //2GB

interface StorageRow extends QueryResultRow {
  id: string;
  user_id: string;
  storage_quota: number;
}

interface StorgeMetrics {
  quota: number;
  usage: number;
  remaining: number;
}

interface UploadValidation {
  allowed: boolean;
  newUsage: number;
  remainingAfterUpload: number;
}

type Queryable = Pick<PoolClient, 'query'>;

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const StorageModel = {
  async createForUser(userId: string, client?: Queryable) {
    await runQuery(
      `INSERT INTO storages (user_id, storage_quota)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId, STORAGE_QUOTA],
      client,
    );
  },

  async getStorageMetrics(userId: string): Promise<StorgeMetrics> {
    const result = await query<StorageRow>(
      `SELECT *
       FROM storages
       WHERE user_id = $1`,
      [userId],
    );
    const storage = result.rows[0];
    if (!storage) throw new NotFoundException('Storage record not found');
    const usage = await FileModel.calculateUsage(userId);
    return {
      quota: storage.storage_quota,
      usage,
      remaining: storage.storage_quota - usage,
    };
  },

  async validateUpload(
    userId: string,
    totalFileSize: number,
  ): Promise<UploadValidation> {
    if (totalFileSize < 0)
      throw new BadRequestException('File size must be positive');

    const metrics = await this.getStorageMetrics(userId);
    const hasSpace = metrics.remaining >= totalFileSize;

    if (!hasSpace) {
      const shortFall = totalFileSize - metrics.remaining;
      throw new BadRequestException(
        `Insufficient storage. ${formatBytes(shortFall)} needed.`,
        ErrorCodeEnum.INSUFFICIENT_STORAGE,
      );
    }

    return {
      allowed: true,
      newUsage: metrics.usage + totalFileSize,
      remainingAfterUpload: metrics.remaining - totalFileSize,
    };
  },

  async updateQuota(userId: string, storageQuota: number, client?: Queryable) {
    await runQuery(
      `UPDATE storages
       SET storage_quota = $1
       WHERE user_id = $2`,
      [storageQuota, userId],
      client,
    );
  },
};

export default StorageModel;
