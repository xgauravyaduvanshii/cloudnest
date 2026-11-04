import path from 'path';
import fs from 'fs';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';
import { logger } from '../utils/logger';
import UserModel from '../models/user.model';
import FolderModel from '../models/folder.model';
import FileModel from '../models/file.model';
import { UploadSourceEnum } from '../models/file.model';
import UploadJobModel, {
  ConflictPolicy,
  NewUploadItem,
  UploadJobMode,
} from '../models/upload-job.model';
import { StorageProviderType } from '../models/storage-account.model';
import {
  chooseStorageAccountForUpload,
} from './storage-accounts.service';
import { wakeUploadWorker } from './upload-jobs.worker';

const normalizeRelativePaths = (input?: string | string[]) => {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
};

const getProviderFileName = (file: Express.Multer.File) =>
  path.basename(file.originalname || 'file');

const toJobView = (
  job: NonGuardJob,
  progress: Awaited<ReturnType<typeof UploadJobModel.getProgress>>,
) => ({
  id: job.id,
  userId: job.userId,
  provider: job.provider,
  storageAccountId: job.storageAccountId,
  status: job.status,
  mode: job.mode,
  conflictPolicy: job.conflictPolicy,
  folderId: job.folderId,
  providerFolderId: job.providerFolderId,
  createdAt: job.createdAt,
  startedAt: job.startedAt,
  completedAt: job.completedAt,
  progress: {
    total: progress.total,
    uploaded: progress.uploaded,
    failed: progress.failed,
    skipped: progress.skipped,
    remaining: progress.remaining,
    pending: progress.pending,
    uploading: progress.uploading,
    totalBytes: progress.totalBytes,
    processedBytes: progress.processedBytes,
  },
});

type NonGuardJob = Awaited<ReturnType<typeof UploadJobModel.findById>> & object;

const requireOwnedJob = async (jobId: string, userId: string) => {
  const job = await UploadJobModel.findByIdForUser(jobId, userId);
  if (!job) throw new NotFoundException('Upload job not found');
  return job;
};

export const createUploadJobService = async (
  userId: string | undefined,
  files: Express.Multer.File[],
  uploadedVia: keyof typeof UploadSourceEnum,
  options: {
    folderId?: string | null;
    provider?: StorageProviderType;
    storageAccountId?: string | null;
    providerFolderId?: string | null;
    mode?: UploadJobMode;
    conflictPolicy?: ConflictPolicy;
    relativePaths?: string | string[];
    clientRequestId?: string | null;
  } = {},
) => {
  void uploadedVia;
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const user = await UserModel.findById(userId);
  if (!user) throw new UnauthorizedException('Unauthorized access');
  if (!files?.length) throw new BadRequestException('No files provided');

  const providerType = options.provider || 'S3';
  const mode: UploadJobMode = options.mode === 'PRESERVE_STRUCTURE' ? 'PRESERVE_STRUCTURE' : 'FLAT';
  const conflictPolicy: ConflictPolicy =
    options.conflictPolicy === 'RENAME' || options.conflictPolicy === 'VERSION'
      ? options.conflictPolicy
      : 'SKIP';

  // When a fixed provider folder is targeted, it must be scoped to an exact account.
  if (options.providerFolderId && !options.storageAccountId) {
    throw new BadRequestException(
      'storageAccountId is required when providerFolderId is provided',
    );
  }

  if (options.folderId) {
    const folder = await FolderModel.findByIdForUser(
      options.folderId,
      userId,
      providerType,
    );
    if (!folder) throw new NotFoundException('Folder not found');
  }

  const totalFileSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
  const account = await chooseStorageAccountForUpload(
    userId,
    totalFileSize,
    providerType,
    options.storageAccountId,
  );

  const relativePaths = normalizeRelativePaths(options.relativePaths);
  const items: NewUploadItem[] = files.map((file, index) => {
    const relativePath = relativePaths[index] || file.originalname;
    return {
      itemIndex: index,
      originalName: getProviderFileName(file),
      relativePath,
      ext: path.extname(file.originalname)?.slice(1)?.toLowerCase() || null,
      mimeType: file.mimetype,
      size: file.size || 0,
      storageTmpPath: file.path || null,
      maxAttempts: 5,
    };
  });

  const job = await UploadJobModel.create({
    userId,
    storageAccountId: account.id,
    provider: account.provider,
    mode,
    conflictPolicy,
    folderId: options.folderId || null,
    providerFolderId: options.providerFolderId || null,
    clientRequestId: options.clientRequestId || null,
    items,
  });

  // Move the job into the queue and nudge the worker for a prompt first tick.
  await UploadJobModel.updateStatus(job.id, 'PENDING');
  wakeUploadWorker();

  const progress = await UploadJobModel.getProgress(job.id);
  return toJobView(job, progress);
};

export const getUploadJobService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  const progress = await UploadJobModel.getProgress(job.id);
  const items = await UploadJobModel.findItemsByJob(job.id);
  return {
    ...toJobView(job, progress),
    items: items.map((item) => ({
      id: item.id,
      itemIndex: item.itemIndex,
      status: item.status,
      originalName: item.originalName,
      relativePath: item.relativePath,
      size: item.size,
      checksumSha256: item.checksumSha256,
      fileId: item.fileId,
      providerFileId: item.providerFileId,
      attemptCount: item.attemptCount,
      maxAttempts: item.maxAttempts,
      nextRetryAt: item.nextRetryAt,
      errorMessage: item.errorMessage,
    })),
  };
};

export const getUploadJobItemsFilesService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  const items = await UploadJobModel.findItemsByJob(job.id);
  const fileIds = items.map((item) => item.fileId).filter(Boolean) as string[];
  const files = await FileModel.findByIdsForUser(fileIds, userId);
  return { job, files };
};

export const pauseUploadJobService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
    throw new BadRequestException(`Cannot pause a ${job.status} job`);
  }
  const updated = await UploadJobModel.requestPause(job.id);
  const progress = await UploadJobModel.getProgress(job.id);
  return updated ? toJobView(updated, progress) : null;
};

export const resumeUploadJobService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  if (job.status !== 'PAUSED') {
    throw new BadRequestException(`Cannot resume a ${job.status} job`);
  }
  const updated = await UploadJobModel.requestResume(job.id);
  wakeUploadWorker();
  const progress = await UploadJobModel.getProgress(job.id);
  return updated ? toJobView(updated, progress) : null;
};

export const cancelUploadJobService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  if (
    ['COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'CANCELLED'].includes(job.status)
  ) {
    throw new BadRequestException(`Cannot cancel a ${job.status} job`);
  }
  const updated = await UploadJobModel.requestCancel(job.id);
  // Clean up temp files for items that will never run.
  const items = await UploadJobModel.findItemsByJob(job.id);
  for (const item of items) {
    if (item.status === 'PENDING' && item.storageTmpPath) {
      await fs.promises
        .unlink(item.storageTmpPath)
        .catch((error) => logger.warn('Failed to clean temp file', error));
    }
  }
  const progress = await UploadJobModel.getProgress(job.id);
  return updated ? toJobView(updated, progress) : null;
};

export const retryUploadJobService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  if (!['PARTIAL_FAILED', 'FAILED', 'COMPLETED'].includes(job.status)) {
    throw new BadRequestException(`Cannot retry a ${job.status} job`);
  }
  const requeued = await UploadJobModel.retryFailedItems(job.id);
  if (!requeued) {
    throw new BadRequestException('No failed items to retry');
  }
  await UploadJobModel.updateStatus(job.id, 'PENDING');
  wakeUploadWorker();
  const progress = await UploadJobModel.getProgress(job.id);
  return toJobView(job, progress);
};

export const getUploadJobProgressService = async (userId: string, jobId: string) => {
  const job = await requireOwnedJob(jobId, userId);
  const progress = await UploadJobModel.getProgress(job.id);
  return toJobView(job, progress);
};

export const listUploadJobsService = async (
  userId: string,
  pagination: { pageSize: number; pageNumber: number },
) => {
  const skip = (pagination.pageNumber - 1) * pagination.pageSize;
  const jobs = await UploadJobModel.listForUser(userId, {
    limit: pagination.pageSize,
    offset: skip,
  });
  const withProgress = await Promise.all(
    jobs.map(async (job) => toJobView(job, await UploadJobModel.getProgress(job.id))),
  );
  return { jobs: withProgress, pagination };
};
