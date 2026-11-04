export type UploadJobStatus =
  | "PENDING"
  | "PROCESSING"
  | "PAUSED"
  | "COMPLETED"
  | "PARTIAL_FAILED"
  | "FAILED"
  | "CANCELLED";

export type UploadItemStatus =
  | "PENDING"
  | "UPLOADING"
  | "UPLOADED"
  | "SKIPPED"
  | "FAILED";

export type UploadJobMode = "FLAT" | "PRESERVE_STRUCTURE";
export type ConflictPolicy = "SKIP" | "RENAME" | "VERSION";

export interface UploadJobProgress {
  total: number;
  uploaded: number;
  failed: number;
  skipped: number;
  remaining: number;
  pending: number;
  uploading: number;
  totalBytes: number;
  processedBytes: number;
}

export interface UploadJob {
  id: string;
  userId: string;
  provider: string;
  storageAccountId: string | null;
  status: UploadJobStatus;
  mode: UploadJobMode;
  conflictPolicy: ConflictPolicy;
  folderId: string | null;
  providerFolderId: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  progress: UploadJobProgress;
}

export interface UploadJobItem {
  id: string;
  itemIndex: number;
  status: UploadItemStatus;
  originalName: string;
  relativePath: string | null;
  size: number;
  checksumSha256: string | null;
  fileId: string | null;
  providerFileId: string | null;
  attemptCount: number;
  maxAttempts: number;
  nextRetryAt: string | null;
  errorMessage: string | null;
}

export interface UploadJobDetail extends UploadJob {
  items: UploadJobItem[];
}

export interface UploadJobResponse {
  message: string;
  data: UploadJob;
}

export interface UploadJobDetailResponse {
  message: string;
  data: UploadJobDetail;
}

export interface ListUploadJobsResponse {
  message: string;
  data: {
    jobs: UploadJob[];
    pagination: { pageSize: number; pageNumber: number };
  };
}

export const TERMINAL_JOB_STATUSES: UploadJobStatus[] = [
  "COMPLETED",
  "PARTIAL_FAILED",
  "FAILED",
  "CANCELLED",
];

export const isTerminalJob = (status: UploadJobStatus) =>
  TERMINAL_JOB_STATUSES.includes(status);
