import { query } from '../config/database.config';
import { formatBytes } from '../utils/format-byte';
import StorageModel from '../models/storage.model';
import StorageAccountModel from '../models/storage-account.model';
import { UnauthorizedException } from '../utils/app-error';

interface AnalyticsRow {
  date: string;
  uploadedFiles: number;
  usages: number;
}

export const getUserAnalyticsWithChartService = async (
  user: Express.User | undefined,
  filter: {
    dateFrom?: Date;
    dateTo?: Date;
  },
) => {
  const userId = user?._id;
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const isAdmin = user.role === 'ADMIN';

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
  const activeStorageAccounts = await StorageAccountModel.findEligibleForUser(userId);
  const accountsWithProviderLimits = activeStorageAccounts.filter(
    (account) => account.cachedLimitBytes !== null && account.cachedLimitBytes > 0,
  );
  const providerUsage = accountsWithProviderLimits.reduce(
    (sum, account) => sum + account.cachedUsageBytes,
    0,
  );
  const providerQuota = accountsWithProviderLimits.reduce(
    (sum, account) => sum + (account.cachedLimitBytes || 0),
    0,
  );
  const hasProviderCapacity = providerQuota > 0;

  return {
    chart: formattedChartData,
    totaluploadFilesForPeriod,
    totalUsageForPeriod: formatBytes(totalUsageForPeriod),

    storageUsageSummary: {
      appManagedUsage: storageMetrics.usage,
      appManagedQuota: storageMetrics.quota,
      capacitySource: isAdmin
        ? 'admin_unlimited'
        : hasProviderCapacity
          ? 'provider'
          : 'app',
      totalUsage: isAdmin
        ? storageMetrics.usage
        : hasProviderCapacity
          ? providerUsage
          : storageMetrics.usage,
      quota: isAdmin
        ? null
        : hasProviderCapacity
          ? providerQuota
          : storageMetrics.quota,
      formattedTotalUsage: formatBytes(
        isAdmin
          ? storageMetrics.usage
          : hasProviderCapacity
            ? providerUsage
            : storageMetrics.usage,
      ),
      formattedQuota: isAdmin
        ? 'Unlimited'
        : formatBytes(hasProviderCapacity ? providerQuota : storageMetrics.quota),
    },
  };
};
