import { PoolClient, QueryResultRow } from 'pg';
import { query, withTransaction } from '../config/database.config';
import { StorageProviderType } from './storage-account.model';

export type UploadJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'PARTIAL_FAILED'
  | 'FAILED'
  | 'CANCELLED';

export type UploadItemStatus =
  | 'PENDING'
  | 'UPLOADING'
  | 'UPLOADED'
  | 'SKIPPED'
  | 'FAILED';

export type UploadJobMode = 'FLAT' | 'PRESERVE_STRUCTURE';
export type ConflictPolicy = 'SKIP' | 'RENAME' | 'VERSION';

const JOB_STATUSES: UploadJobStatus[] = [
  'PENDING',
  'PROCESSING',
  'PAUSED',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
  'CANCELLED',
];

interface UploadJobRow extends QueryResultRow {
  id: string;
  user_id: string;
  storage_account_id: string | null;
  provider: StorageProviderType;
  status: UploadJobStatus;
  mode: UploadJobMode;
  conflict_policy: ConflictPolicy;
  folder_id: string | null;
  provider_folder_id: string | null;
  client_request_id: string | null;
  total_items: number;
  total_bytes: string | number;
  processed_bytes: string | number;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UploadJobDocument {
  id: string;
  userId: string;
  storageAccountId: string | null;
  provider: StorageProviderType;
  status: UploadJobStatus;
  mode: UploadJobMode;
  conflictPolicy: ConflictPolicy;
  folderId: string | null;
  providerFolderId: string | null;
  clientRequestId: string | null;
  totalItems: number;
  totalBytes: number;
  processedBytes: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UploadJobItemRow extends QueryResultRow {
  id: string;
  job_id: string;
  item_index: number;
  status: UploadItemStatus;
  original_name: string;
  relative_path: string | null;
  ext: string | null;
  mime_type: string | null;
  size: string | number;
  checksum_sha256: string | null;
  storage_tmp_path: string | null;
  file_id: string | null;
  provider_file_id: string | null;
  remote_folder_id: string | null;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: Date | null;
  locked_at: Date | null;
  worker_id: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UploadJobItemDocument {
  id: string;
  jobId: string;
  itemIndex: number;
  status: UploadItemStatus;
  originalName: string;
  relativePath: string | null;
  ext: string | null;
  mimeType: string | null;
  size: number;
  checksumSha256: string | null;
  storageTmpPath: string | null;
  fileId: string | null;
  providerFileId: string | null;
  remoteFolderId: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: Date | null;
  lockedAt: Date | null;
  workerId: string | null;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type Queryable = Pick<PoolClient, 'query'>;

const runQuery = async <T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  client?: Queryable,
) => (client ? client.query<T>(text, params) : query<T>(text, params));

const toJobDocument = (row: UploadJobRow): UploadJobDocument => ({
  id: row.id,
  userId: row.user_id,
  storageAccountId: row.storage_account_id,
  provider: row.provider,
  status: row.status,
  mode: row.mode,
  conflictPolicy: row.conflict_policy,
  folderId: row.folder_id,
  providerFolderId: row.provider_folder_id,
  clientRequestId: row.client_request_id,
  totalItems: Number(row.total_items),
  totalBytes: Number(row.total_bytes),
  processedBytes: Number(row.processed_bytes),
  errorMessage: row.error_message,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toItemDocument = (row: UploadJobItemRow): UploadJobItemDocument => ({
  id: row.id,
  jobId: row.job_id,
  itemIndex: row.item_index,
  status: row.status,
  originalName: row.original_name,
  relativePath: row.relative_path,
  ext: row.ext,
  mimeType: row.mime_type,
  size: Number(row.size),
  checksumSha256: row.checksum_sha256,
  storageTmpPath: row.storage_tmp_path,
  fileId: row.file_id,
  providerFileId: row.provider_file_id,
  remoteFolderId: row.remote_folder_id,
  attemptCount: row.attempt_count,
  maxAttempts: row.max_attempts,
  nextRetryAt: row.next_retry_at,
  lockedAt: row.locked_at,
  workerId: row.worker_id,
  errorMessage: row.error_message,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export interface NewUploadItem {
  itemIndex: number;
  originalName: string;
  relativePath?: string | null;
  ext?: string | null;
  mimeType?: string | null;
  size: number;
  checksumSha256?: string | null;
  storageTmpPath?: string | null;
  maxAttempts?: number;
}

export const UploadJobModel = {
  async create(data: {
    userId: string;
    storageAccountId: string | null;
    provider: StorageProviderType;
    mode: UploadJobMode;
    conflictPolicy: ConflictPolicy;
    folderId?: string | null;
    providerFolderId?: string | null;
    clientRequestId?: string | null;
    items: NewUploadItem[];
  }): Promise<UploadJobDocument> {
    const totalBytes = data.items.reduce((sum, item) => sum + (item.size || 0), 0);

    return withTransaction(async (client) => {
      // Idempotency: return the existing job if this client request id was seen.
      if (data.clientRequestId) {
        const existing = await client.query<UploadJobRow>(
          `SELECT * FROM upload_jobs
           WHERE user_id = $1 AND client_request_id = $2
           LIMIT 1`,
          [data.userId, data.clientRequestId],
        );
        if (existing.rows[0]) return toJobDocument(existing.rows[0]);
      }

      const jobResult = await client.query<UploadJobRow>(
        `INSERT INTO upload_jobs (
          user_id, storage_account_id, provider, status, mode, conflict_policy,
          folder_id, provider_folder_id, client_request_id, total_items, total_bytes
        )
        VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          data.userId,
          data.storageAccountId,
          data.provider,
          data.mode,
          data.conflictPolicy,
          data.folderId || null,
          data.providerFolderId || null,
          data.clientRequestId || null,
          data.items.length,
          totalBytes,
        ],
      );
      const job = toJobDocument(jobResult.rows[0]);

      for (const item of data.items) {
        await client.query(
          `INSERT INTO upload_job_items (
            job_id, item_index, status, original_name, relative_path, ext, mime_type,
            size, checksum_sha256, storage_tmp_path, max_attempts
          )
          VALUES ($1, $2, 'PENDING', $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            job.id,
            item.itemIndex,
            item.originalName,
            item.relativePath || null,
            item.ext || null,
            item.mimeType || null,
            item.size || 0,
            item.checksumSha256 || null,
            item.storageTmpPath || null,
            item.maxAttempts ?? 5,
          ],
        );
      }

      return job;
    });
  },

  async findById(id: string) {
    const result = await query<UploadJobRow>(
      `SELECT * FROM upload_jobs WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toJobDocument(result.rows[0]) : null;
  },

  async findByIdForUser(id: string, userId: string) {
    const result = await query<UploadJobRow>(
      `SELECT * FROM upload_jobs WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ? toJobDocument(result.rows[0]) : null;
  },

  async listForUser(
    userId: string,
    pagination: { limit: number; offset: number },
  ) {
    const result = await query<UploadJobRow>(
      `SELECT * FROM upload_jobs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, pagination.limit, pagination.offset],
    );
    return result.rows.map(toJobDocument);
  },

  async updateStatus(
    id: string,
    status: UploadJobStatus,
    extras: { errorMessage?: string | null } = {},
  ) {
    const setCompleted = ['COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'].includes(
      status,
    );
    const result = await query<UploadJobRow>(
      `UPDATE upload_jobs
       SET status = $2,
           error_message = $3,
           started_at = CASE WHEN $2 = 'PROCESSING' THEN COALESCE(started_at, NOW()) ELSE started_at END,
           completed_at = CASE WHEN $4::boolean THEN COALESCE(completed_at, NOW()) ELSE completed_at END
       WHERE id = $1
       RETURNING *`,
      [id, status, extras.errorMessage ?? null, setCompleted],
    );
    return result.rows[0] ? toJobDocument(result.rows[0]) : null;
  },

  async addProcessedBytes(id: string, bytes: number) {
    await query(
      `UPDATE upload_jobs SET processed_bytes = processed_bytes + $2 WHERE id = $1`,
      [id, bytes],
    );
  },

  /**
   * Aggregate live progress for a job: counts per item status plus byte totals.
   */
  async getProgress(id: string) {
    const result = await query<
      QueryResultRow & {
        total: number;
        pending: number;
        uploading: number;
        uploaded: number;
        skipped: number;
        failed: number;
      }
    >(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
         COUNT(*) FILTER (WHERE status = 'UPLOADING')::int AS uploading,
         COUNT(*) FILTER (WHERE status = 'UPLOADED')::int AS uploaded,
         COUNT(*) FILTER (WHERE status = 'SKIPPED')::int AS skipped,
         COUNT(*) FILTER (WHERE status = 'FAILED')::int AS failed
       FROM upload_job_items
       WHERE job_id = $1`,
      [id],
    );
    const counts = result.rows[0] || {
      total: 0,
      pending: 0,
      uploading: 0,
      uploaded: 0,
      skipped: 0,
      failed: 0,
    };
    const job = await this.findById(id);
    return {
      job,
      total: counts.total,
      pending: counts.pending,
      uploading: counts.uploading,
      uploaded: counts.uploaded,
      skipped: counts.skipped,
      failed: counts.failed,
      remaining: counts.pending + counts.uploading,
      totalBytes: job?.totalBytes ?? 0,
      processedBytes: job?.processedBytes ?? 0,
    };
  },

  /**
   * Derive and persist the terminal job status from its item counts. Returns null
   * if the job is still in progress (some items PENDING/UPLOADING).
   */
  async finalizeStatus(id: string) {
    const progress = await this.getProgress(id);
    if (progress.remaining > 0) return progress.job;

    let status: UploadJobStatus;
    if (progress.total === 0) {
      status = 'FAILED';
    } else if (progress.failed === 0) {
      status = 'COMPLETED';
    } else if (progress.uploaded + progress.skipped === 0) {
      status = 'FAILED';
    } else {
      status = 'PARTIAL_FAILED';
    }
    return this.updateStatus(id, status);
  },

  // ---- Item operations -------------------------------------------------------

  async findItemsByJob(jobId: string) {
    const result = await query<UploadJobItemRow>(
      `SELECT * FROM upload_job_items WHERE job_id = $1 ORDER BY item_index ASC`,
      [jobId],
    );
    return result.rows.map(toItemDocument);
  },

  async findItemById(id: string) {
    const result = await query<UploadJobItemRow>(
      `SELECT * FROM upload_job_items WHERE id = $1`,
      [id],
    );
    return result.rows[0] ? toItemDocument(result.rows[0]) : null;
  },

  /**
   * Claim up to `limit` runnable items for a worker using SELECT ... FOR UPDATE SKIP
   * LOCKED, honoring per-account concurrency (account.max_upload_concurrency) and
   * next_retry_at backoff windows. Claimed items transition to UPLOADING.
   */
  async claimItems(workerId: string, limit: number): Promise<UploadJobItemDocument[]> {
    const result = await query<UploadJobItemRow>(
      `WITH eligible AS (
         SELECT i.id
         FROM upload_job_items i
         JOIN upload_jobs j ON j.id = i.job_id
         JOIN storage_accounts sa ON sa.id = j.storage_account_id
         WHERE i.status = 'PENDING'
           AND (i.next_retry_at IS NULL OR i.next_retry_at <= NOW())
           AND j.status IN ('PENDING', 'PROCESSING')
           AND (
             SELECT COUNT(*)
             FROM upload_job_items busy
             WHERE busy.status = 'UPLOADING'
               AND busy.job_id IN (
                 SELECT id FROM upload_jobs WHERE storage_account_id = sa.id
               )
           ) < sa.max_upload_concurrency
         ORDER BY j.created_at ASC, i.item_index ASC
         LIMIT $1
         FOR UPDATE OF i SKIP LOCKED
       )
       UPDATE upload_job_items i
       SET status = 'UPLOADING',
           locked_at = NOW(),
           worker_id = $2,
           attempt_count = i.attempt_count + 1
       FROM eligible e
       WHERE i.id = e.id
       RETURNING i.*`,
      [limit, workerId],
    );
    return result.rows.map(toItemDocument);
  },

  async markItemUploaded(itemId: string, data: {
    fileId?: string | null;
    providerFileId?: string | null;
    remoteFolderId?: string | null;
    checksumSha256?: string | null;
    size?: number;
  }) {
    await query(
      `UPDATE upload_job_items
       SET status = 'UPLOADED',
           file_id = COALESCE($2, file_id),
           provider_file_id = COALESCE($3, provider_file_id),
           remote_folder_id = COALESCE($4, remote_folder_id),
           checksum_sha256 = COALESCE($5, checksum_sha256),
           error_message = NULL,
           next_retry_at = NULL,
           locked_at = NULL,
           worker_id = NULL
       WHERE id = $1`,
      [
        itemId,
        data.fileId || null,
        data.providerFileId || null,
        data.remoteFolderId || null,
        data.checksumSha256 || null,
      ],
    );
  },

  async markItemSkipped(itemId: string, data: {
    fileId?: string | null;
    providerFileId?: string | null;
    checksumSha256?: string | null;
  }) {
    await query(
      `UPDATE upload_job_items
       SET status = 'SKIPPED',
           file_id = COALESCE($2, file_id),
           provider_file_id = COALESCE($3, provider_file_id),
           checksum_sha256 = COALESCE($4, checksum_sha256),
           error_message = NULL,
           locked_at = NULL,
           worker_id = NULL
       WHERE id = $1`,
      [itemId, data.fileId || null, data.providerFileId || null, data.checksumSha256 || null],
    );
  },

  /**
   * Record a failed attempt. If retries remain, schedule next_retry_at (backoff) and
   * return the item to PENDING; otherwise mark it terminally FAILED.
   */
  async markItemFailure(itemId: string, message: string, retryAfterMs: number | null) {
    const item = await this.findItemById(itemId);
    if (!item) return null;
    const canRetry = item.attemptCount < item.maxAttempts;

    if (canRetry) {
      const result = await query<UploadJobItemRow>(
        `UPDATE upload_job_items
         SET status = 'PENDING',
             error_message = $2,
             next_retry_at = NOW() + ($3 || ' milliseconds')::interval,
             locked_at = NULL,
             worker_id = NULL
         WHERE id = $1
         RETURNING *`,
        [itemId, message, String(retryAfterMs ?? 0)],
      );
      return toItemDocument(result.rows[0]);
    }

    const result = await query<UploadJobItemRow>(
      `UPDATE upload_job_items
       SET status = 'FAILED',
           error_message = $2,
           locked_at = NULL,
           worker_id = NULL
       WHERE id = $1
       RETURNING *`,
      [itemId, message],
    );
    return toItemDocument(result.rows[0]);
  },

  async setItemChecksum(itemId: string, checksum: string) {
    await query(
      `UPDATE upload_job_items SET checksum_sha256 = $2 WHERE id = $1`,
      [itemId, checksum],
    );
  },

  /**
   * Reset items stuck in UPLOADING (e.g. after a worker crash / graceful shutdown)
   * back to PENDING so they can be re-claimed. Only touches the given job when set.
   */
  async requeueStaleItems(workerId?: string) {
    const result = workerId
      ? await query(
          `UPDATE upload_job_items
           SET status = 'PENDING', locked_at = NULL, worker_id = NULL
           WHERE status = 'UPLOADING' AND worker_id = $1`,
          [workerId],
        )
      : await query(
          `UPDATE upload_job_items
           SET status = 'PENDING', locked_at = NULL, worker_id = NULL
           WHERE status = 'UPLOADING'`,
        );
    return result.rowCount || 0;
  },

  async requestPause(jobId: string) {
    return this.updateStatus(jobId, 'PAUSED');
  },

  async requestResume(jobId: string) {
    return this.updateStatus(jobId, 'PROCESSING');
  },

  async requestCancel(jobId: string) {
    // Cancel: stop scheduling; items still PENDING remain but job won't be claimed.
    return this.updateStatus(jobId, 'CANCELLED');
  },

  async retryFailedItems(jobId: string) {
    const result = await query(
      `UPDATE upload_job_items
       SET status = 'PENDING', attempt_count = 0, next_retry_at = NULL,
           error_message = NULL, locked_at = NULL, worker_id = NULL
       WHERE job_id = $1 AND status = 'FAILED'`,
      [jobId],
    );
    return result.rowCount || 0;
  },
};

export { JOB_STATUSES };
export default UploadJobModel;
