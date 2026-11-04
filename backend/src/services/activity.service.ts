import { query } from '../config/database.config';
import ActivityModel, { ActivityActorType } from '../models/activity.model';
import { formatBytes } from '../utils/format-byte';
import { UnauthorizedException } from '../utils/app-error';

const assertUser = (userId: string | undefined) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return userId;
};

/** Paginated activity timeline for the current user. */
export const getActivityTimelineService = async (
  userId: string | undefined,
  pagination: { pageSize: number; pageNumber: number },
  filter?: { action?: string; entityType?: string },
) => {
  const uid = assertUser(userId);
  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;
  const [events, totalCount] = await Promise.all([
    ActivityModel.listForUser(uid, { limit: pageSize, offset: skip }, filter),
    ActivityModel.countForUser(uid, { action: filter?.action }),
  ]);
  return {
    events,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
    },
  };
};

interface BreakdownRow {
  provider: string;
  storage_account_id: string | null;
  storage_account_name: string | null;
  file_count: number;
  total_size: number;
}

/** Usage grouped by provider and by storage account (latest versions only). */
export const getStorageBreakdownService = async (userId: string | undefined) => {
  const uid = assertUser(userId);
  const result = await query<BreakdownRow>(
    `SELECT
       f.provider,
       f.storage_account_id,
       sa.display_name AS storage_account_name,
       COUNT(*)::int AS file_count,
       COALESCE(SUM(f.size), 0)::bigint AS total_size
     FROM files f
     LEFT JOIN storage_accounts sa ON sa.id = f.storage_account_id
     WHERE f.user_id = $1 AND f.is_latest = TRUE
     GROUP BY f.provider, f.storage_account_id, sa.display_name
     ORDER BY total_size DESC`,
    [uid],
  );
  const rows = result.rows.map((r) => ({
    ...r,
    totalSize: Number(r.total_size),
    formattedTotalSize: formatBytes(Number(r.total_size)),
  }));
  const byProvider = new Map<string, { fileCount: number; totalSize: number }>();
  for (const r of rows) {
    const agg = byProvider.get(r.provider) || { fileCount: 0, totalSize: 0 };
    agg.fileCount += r.file_count;
    agg.totalSize += r.totalSize;
    byProvider.set(r.provider, agg);
  }
  return {
    byProvider: [...byProvider.entries()].map(([provider, v]) => ({
      provider,
      fileCount: v.fileCount,
      totalSize: v.totalSize,
      formattedTotalSize: formatBytes(v.totalSize),
    })),
    byAccount: rows,
  };
};

/** Upload reliability: success/failure/skip counts and rate over the user's job items. */
export const getUploadReliabilityService = async (userId: string | undefined) => {
  const uid = assertUser(userId);
  const result = await query<{
    uploaded: number;
    failed: number;
    skipped: number;
    pending: number;
    duplicate_savings: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE i.status = 'UPLOADED')::int AS uploaded,
       COUNT(*) FILTER (WHERE i.status = 'FAILED')::int AS failed,
       COUNT(*) FILTER (WHERE i.status = 'SKIPPED')::int AS skipped,
       COUNT(*) FILTER (WHERE i.status IN ('PENDING', 'UPLOADING'))::int AS pending,
       COALESCE(SUM(i.size) FILTER (WHERE i.status = 'SKIPPED'), 0)::bigint AS duplicate_savings
     FROM upload_job_items i
     JOIN upload_jobs j ON j.id = i.job_id
     WHERE j.user_id = $1`,
    [uid],
  );
  const r = result.rows[0];
  const terminal = r.uploaded + r.failed;
  return {
    uploaded: r.uploaded,
    failed: r.failed,
    skipped: r.skipped,
    pending: r.pending,
    successRate: terminal > 0 ? Math.round((r.uploaded / terminal) * 100) : null,
    duplicateSavingsBytes: Number(r.duplicate_savings),
    formattedDuplicateSavings: formatBytes(Number(r.duplicate_savings)),
  };
};

/** Largest files and most-downloaded shared files. */
export const getTopFilesService = async (userId: string | undefined, limit = 10) => {
  const uid = assertUser(userId);
  const [largest, mostDownloaded] = await Promise.all([
    query<{ id: string; original_name: string; size: number; mime_type: string }>(
      `SELECT id, original_name, size::int AS size, mime_type
       FROM files WHERE user_id = $1 AND is_latest = TRUE
       ORDER BY size DESC LIMIT $2`,
      [uid, limit],
    ),
    query<{ file_id: string; original_name: string; downloads: number }>(
      `SELECT s.resource_id AS file_id, f.original_name, SUM(s.download_count)::int AS downloads
       FROM shares s
       JOIN files f ON f.id = s.resource_id
       WHERE s.user_id = $1 AND s.resource_type = 'file'
       GROUP BY s.resource_id, f.original_name
       ORDER BY downloads DESC LIMIT $2`,
      [uid, limit],
    ),
  ]);
  return {
    largest: largest.rows.map((r) => ({
      ...r,
      formattedSize: formatBytes(r.size),
    })),
    mostDownloaded: mostDownloaded.rows,
  };
};

/** Quota-near-limit notifications: accounts whose cached usage is above a threshold. */
export const getQuotaAlertsService = async (userId: string | undefined, thresholdPct = 0.9) => {
  const uid = assertUser(userId);
  const result = await query<{
    id: string;
    display_name: string;
    provider: string;
    cached_usage_bytes: number;
    cached_limit_bytes: number | null;
  }>(
    `SELECT id, display_name, provider,
            COALESCE(cached_usage_bytes, 0)::bigint AS cached_usage_bytes,
            cached_limit_bytes::bigint
     FROM storage_accounts
     WHERE user_id = $1
       AND owner_type = 'USER'
       AND status = 'ACTIVE'
       AND cached_limit_bytes IS NOT NULL
       AND cached_limit_bytes > 0
       AND COALESCE(cached_usage_bytes, 0)::numeric / NULLIF(cached_limit_bytes, 0)::numeric >= $2`,
    [uid, thresholdPct],
  );
  return result.rows.map((r) => {
    const usage = Number(r.cached_usage_bytes);
    const limit = Number(r.cached_limit_bytes);
    return {
      storageAccountId: r.id,
      displayName: r.display_name,
      provider: r.provider,
      usageBytes: usage,
      limitBytes: limit,
      usedPercent: Math.round((usage / limit) * 100),
      formattedUsage: formatBytes(usage),
      formattedLimit: formatBytes(limit),
    };
  });
};

export type { ActivityActorType };
