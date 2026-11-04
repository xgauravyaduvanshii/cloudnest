export interface ActivityEvent {
  _id: string;
  id: string;
  actorType: "user" | "system" | "api";
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityTimelineResponse {
  events: ActivityEvent[];
  pagination: {
    pageSize: number;
    pageNumber: number;
    totalCount: number;
    totalPages: number;
  };
}

export interface StorageBreakdown {
  byProvider: {
    provider: string;
    fileCount: number;
    totalSize: number;
    formattedTotalSize: string;
  }[];
  byAccount: {
    provider: string;
    storage_account_name: string | null;
    file_count: number;
    totalSize: number;
    formattedTotalSize: string;
  }[];
}

export interface UploadReliability {
  uploaded: number;
  failed: number;
  skipped: number;
  pending: number;
  successRate: number | null;
  duplicateSavingsBytes: number;
  formattedDuplicateSavings: string;
}

export interface QuotaAlert {
  storageAccountId: string;
  displayName: string;
  provider: string;
  usageBytes: number;
  limitBytes: number;
  usedPercent: number;
  formattedUsage: string;
  formattedLimit: string;
}
