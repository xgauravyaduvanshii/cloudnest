import { query } from '../config/database.config';
import { formatBytes } from '../utils/format-byte';
import StorageModel from '../models/storage.model';
import { UnauthorizedException } from '../utils/app-error';

interface AnalyticsRow {
  date: string;
  uploadedFiles: number;
  usages: number;
}

export const getUserAnalyticsWithChartService = async (
  userId: string | undefined,
  filter: {
    dateFrom?: Date;
    dateTo?: Date;
  },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { dateFrom, dateTo } = filter;
  const params: unknown[] = [userId];
  const conditions = ['user_id = $1'];

  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`created_at >= $${params.length}`);
  }

  if (dateTo) {
    params.push(dateTo);
    conditions.push(`created_at <= $${params.length}`);
  }

  const result = await query<AnalyticsRow>(
    `SELECT
       TO_CHAR(created_at::date, 'YYYY-MM-DD') AS "date",
       COUNT(*)::int AS "uploadedFiles",
       COALESCE(SUM(size), 0)::bigint AS "usages"
     FROM files
     WHERE ${conditions.join(' AND ')}
     GROUP BY created_at::date
     ORDER BY created_at::date ASC`,
    params,
  );

  const formattedChartData = result.rows.map((item) => ({
    ...item,
    usages: item.usages,
    formattedUsages: formatBytes(item.usages),
  }));

  const totaluploadFilesForPeriod = formattedChartData.reduce(
    (sum, item) => sum + item.uploadedFiles,
    0,
  );
  const totalUsageForPeriod = formattedChartData.reduce(
    (sum, item) => sum + item.usages,
    0,
  );

  const storageMetrics = await StorageModel.getStorageMetrics(userId);

  return {
    chart: formattedChartData,
    totaluploadFilesForPeriod,
    totalUsageForPeriod: formatBytes(totalUsageForPeriod),

    storageUsageSummary: {
      totalUsage: storageMetrics.usage,
      quota: storageMetrics.quota,
      formattedTotalUsage: formatBytes(storageMetrics.usage),
      formattedQuota: formatBytes(storageMetrics.quota),
    },
  };
};
