import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import FileModel, { UploadSourceEnum } from '../models/file.model';
import FolderModel from '../models/folder.model';
import StorageAccountModel, {
  StorageProviderType,
} from '../models/storage-account.model';
import UploadJobModel, {
  UploadJobDocument,
  UploadJobItemDocument,
} from '../models/upload-job.model';
import { getStorageProvider } from '../providers';
import { ProviderUploadFile } from '../providers/storage-provider';
import {
  classifyDriveError,
  computeBackoffDelayMs,
} from '../providers/provider-error';
import { computeFileSha256 } from '../utils/upload-source';
import { sanitizeFilename } from '../utils/helper';
import { logger } from '../utils/logger';
import { Env } from '../config/env.config';

const WORKER_ID = randomUUID();
const POLL_INTERVAL_MS = 1000;

let isRunning = false;
let timer: NodeJS.Timeout | null = null;
let inFlight = 0;

const getRelativeDirParts = (relativePath: string | null | undefined): string[] => {
  if (!relativePath) return [];
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  // Drop the filename segment; keep only the directory components.
  return parts.length > 1 ? parts.slice(0, -1) : [];
};

/**
 * Resolve the app-relative folder name chain for a job that targets an application
 * folder (no fixed provider folder). Mirrors the legacy upload service behavior.
 */
const resolveFolderPathForJob = async (job: UploadJobDocument): Promise<string[]> => {
  if (job.providerFolderId) return [];
  if (!job.folderId) return [];
  const folders = await FolderModel.findPath(job.userId, job.folderId, job.provider);
  return folders.map((folder) => folder.name);
};

/**
 * Compute the logical folder key used for duplicate/version identity. It is stored on
 * files.provider_folder_id so dedup is scoped to the same destination folder.
 */
const computeDedupFolderKey = (
  job: UploadJobDocument,
  relativeDir: string[],
): string => {
  const rel = relativeDir.join('/');
  if (job.providerFolderId) {
    return job.mode === 'PRESERVE_STRUCTURE' && rel
      ? `${job.providerFolderId}/${rel}`
      : job.providerFolderId;
  }
  if (job.folderId) {
    return rel ? `app:${job.folderId}/${rel}` : `app:${job.folderId}`;
  }
  return rel;
};

const buildProviderSource = (
  item: UploadJobItemDocument,
  name: string,
): ProviderUploadFile => ({
  originalname: name,
  mimetype: item.mimeType || 'application/octet-stream',
  size: item.size,
  path: item.storageTmpPath || undefined,
});

const unlinkQuietly = async (tmpPath: string | null | undefined) => {
  if (!tmpPath) return;
  try {
    await fs.promises.unlink(tmpPath);
  } catch {
    // Temp file may already be gone; cleanup is best-effort.
  }
};

/** Generate a non-colliding "name (n).ext" for the RENAME conflict policy. */
const generateUniqueName = async (params: {
  userId: string;
  storageAccountId: string;
  folderKey: string;
  originalName: string;
}): Promise<string> => {
  const ext = path.extname(params.originalName);
  const base = path.basename(params.originalName, ext);
  let candidate = params.originalName;
  for (let n = 1; n <= 1000; n++) {
    const existing = await FileModel.findLatestByName({
      userId: params.userId,
      storageAccountId: params.storageAccountId,
      providerFolderId: params.folderKey,
      originalName: candidate,
    });
    if (!existing) return candidate;
    candidate = `${base} (${n})${ext}`;
  }
  return `${base} (${Date.now()})${ext}`;
};

const syncAccountUsage = async (accountId: string) => {
  const account = await StorageAccountModel.findById(accountId);
  if (!account) return;
  const provider = getStorageProvider(account.provider);
  try {
    const usage = await provider.syncUsage(account);
    await StorageAccountModel.updateUsage(account.id, {
      usageBytes: usage.usageBytes,
      limitBytes: usage.limitBytes,
      usageDetails: usage.details,
      status: 'ACTIVE',
      errorMessage: null,
    });
  } catch (error) {
    logger.warn(`Failed to refresh usage for ${account.id}`, error);
  }
};

/**
 * Process a single claimed upload item: dedup/version check, provider upload,
 * persistence, and failure classification with backoff. The item is already in
 * UPLOADING state (claimed); this function always leaves it in a terminal or
 * re-scheduled state so it is never stuck.
 */
const processItem = async (item: UploadJobItemDocument): Promise<void> => {
  const job = await UploadJobModel.findById(item.jobId);
  if (!job) {
    await UploadJobModel.markItemFailure(item.id, 'Upload job no longer exists', null);
    return;
  }

  try {
    if (!job.storageAccountId) {
      await UploadJobModel.markItemFailure(item.id, 'No storage account for job', null);
      return;
    }
    const account = await StorageAccountModel.findById(job.storageAccountId);
    if (!account) {
      await UploadJobModel.markItemFailure(item.id, 'Storage account not found', null);
      return;
    }

    const relativeDir = getRelativeDirParts(item.relativePath);
    const folderKey = computeDedupFolderKey(job, relativeDir);
    let targetName = item.originalName;

    // Resolve (or compute) the checksum. Reuse the disk temp file.
    const source = buildProviderSource(item, targetName);
    let checksum = item.checksumSha256;
    if (!checksum) {
      checksum = await computeFileSha256(source);
      if (checksum) await UploadJobModel.setItemChecksum(item.id, checksum);
    }

    // 1) Exact duplicate → skip (no remote upload), link to existing file.
    if (checksum) {
      const duplicate = await FileModel.findExactDuplicate({
        userId: job.userId,
        storageAccountId: account.id,
        providerFolderId: folderKey,
        originalName: targetName,
        checksumSha256: checksum,
      });
      if (duplicate) {
        await UploadJobModel.markItemSkipped(item.id, {
          fileId: duplicate.id,
          providerFileId: duplicate.providerFileId,
          checksumSha256: checksum,
        });
        await UploadJobModel.addProcessedBytes(job.id, item.size);
        await unlinkQuietly(item.storageTmpPath);
        return;
      }
    }

    // 2) Same name, different content → apply conflict policy.
    const conflict = checksum
      ? await FileModel.findLatestByName({
          userId: job.userId,
          storageAccountId: account.id,
          providerFolderId: folderKey,
          originalName: targetName,
        })
      : null;

    let versionMeta: {
      versionGroupId: string | null;
      supersedesFileId: string | null;
      versionNumber: number;
    } = { versionGroupId: null, supersedesFileId: null, versionNumber: 1 };

    if (conflict && conflict.checksumSha256 !== checksum) {
      if (job.conflictPolicy === 'SKIP') {
        // "Skip by default": do not clobber or duplicate a differently-named asset.
        await UploadJobModel.markItemSkipped(item.id, {
          fileId: conflict.id,
          providerFileId: conflict.providerFileId,
          checksumSha256: checksum,
        });
        await unlinkQuietly(item.storageTmpPath);
        return;
      }
      if (job.conflictPolicy === 'RENAME') {
        targetName = await generateUniqueName({
          userId: job.userId,
          storageAccountId: account.id,
          folderKey,
          originalName: targetName,
        });
      } else if (job.conflictPolicy === 'VERSION') {
        versionMeta = {
          versionGroupId: conflict.versionGroupId || conflict.id,
          supersedesFileId: conflict.id,
          versionNumber: (conflict.versionNumber || 1) + 1,
        };
      }
    }

    // 3) Upload to the provider using the (possibly renamed) source.
    const uploadSource = buildProviderSource(item, targetName);
    const provider = getStorageProvider(job.provider as StorageProviderType);
    const folderPath =
      job.mode === 'PRESERVE_STRUCTURE'
        ? relativeDir
        : await resolveFolderPathForJob(job);

    const result = await provider.upload(account, job.userId, uploadSource, {
      folderPath,
      providerFolderId: job.providerFolderId || null,
      mode: job.mode,
    });

    const createdFile = await FileModel.create({
      userId: job.userId,
      storageAccountId: account.id,
      folderId: job.folderId || null,
      provider: account.provider,
      storageKey: result.storageKey,
      providerFileId: result.providerFileId,
      providerMetadata: result.metadata,
      originalName: targetName,
      uploadVia: UploadSourceEnum.WEB,
      size: item.size,
      ext: path.extname(targetName)?.slice(1)?.toLowerCase() || item.ext || '',
      url: '',
      mimeType: item.mimeType || 'application/octet-stream',
      checksumSha256: checksum || null,
      originalPath: item.relativePath || targetName,
      providerFolderId: folderKey,
      versionGroupId: versionMeta.versionGroupId,
      supersedesFileId: versionMeta.supersedesFileId,
      versionNumber: versionMeta.versionNumber,
      isLatest: true,
      uploadJobItemId: item.id,
    });

    // Establish a fresh version group from the file's own id when it is v1.
    if (!versionMeta.versionGroupId) {
      await FileModel.setVersionGroup(createdFile.id, createdFile.id);
    } else if (versionMeta.supersedesFileId) {
      await FileModel.markNotLatest(versionMeta.supersedesFileId);
    }

    await UploadJobModel.markItemUploaded(item.id, {
      fileId: createdFile.id,
      providerFileId: result.providerFileId,
      remoteFolderId: (result.metadata.folderId as string) || job.providerFolderId || null,
      checksumSha256: checksum || null,
    });
    await UploadJobModel.addProcessedBytes(job.id, item.size);
    await unlinkQuietly(item.storageTmpPath);
  } catch (error: any) {
    const classified = classifyDriveError(error);
    const message = error?.message || 'Upload failed';

    if (classified.retryable) {
      const retryAfterMs = computeBackoffDelayMs(item.attemptCount, {
        retryAfterMs: classified.retryAfterMs,
      });
      await UploadJobModel.markItemFailure(item.id, message, retryAfterMs);
      logger.warn(
        `Retryable upload failure for item ${item.id} (${classified.kind}); backing off ${retryAfterMs}ms`,
      );
    } else {
      await UploadJobModel.markItemFailure(item.id, message, null);
      logger.error(`Terminal upload failure for item ${item.id}: ${message}`);
    }
  }
};

const finalizeIfComplete = async (jobId: string) => {
  const job = await UploadJobModel.findById(jobId);
  // Never auto-transition a job the user paused or cancelled.
  if (!job || job.status === 'PAUSED' || job.status === 'CANCELLED') return;
  const finalized = await UploadJobModel.finalizeStatus(jobId);
  if (
    finalized &&
    ['COMPLETED', 'PARTIAL_FAILED', 'FAILED'].includes(finalized.status)
  ) {
    if (finalized.storageAccountId) {
      await syncAccountUsage(finalized.storageAccountId);
    }
  }
};

const tick = async () => {
  if (!isRunning) return;
  const concurrency = Math.max(1, Number(Env.UPLOAD_WORKER_CONCURRENCY) || 4);
  const capacity = concurrency - inFlight;
  if (capacity <= 0) return;

  let claimed: UploadJobItemDocument[] = [];
  try {
    claimed = await UploadJobModel.claimItems(WORKER_ID, capacity);
  } catch (error) {
    logger.error('Failed to claim upload items', error);
    return;
  }

  for (const item of claimed) {
    inFlight += 1;
    const jobId = item.jobId;
    processItem(item)
      .catch((error) => logger.error(`Unhandled upload item error for ${item.id}`, error))
      .finally(async () => {
        inFlight -= 1;
        await finalizeIfComplete(jobId).catch((error) =>
          logger.error('Failed to finalize job', error),
        );
      });
  }
};

export const startUploadWorker = () => {
  if (isRunning) return;
  isRunning = true;
  timer = setInterval(() => {
    void tick();
  }, POLL_INTERVAL_MS);
  // Do not keep the process alive solely for the worker timer.
  if (typeof timer.unref === 'function') timer.unref();
  logger.info(`Upload worker started (id=${WORKER_ID})`);
};

export const stopUploadWorker = async () => {
  if (!isRunning) return;
  isRunning = false;
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  try {
    const requeued = await UploadJobModel.requeueStaleItems(WORKER_ID);
    logger.info(`Upload worker stopped; requeued ${requeued} in-flight item(s)`);
  } catch (error) {
    logger.error('Failed to requeue in-flight items on shutdown', error);
  }
};

export const wakeUploadWorker = () => {
  // Nudge the worker to run a tick promptly after a new job is enqueued.
  if (isRunning) void tick();
};

export const __workerInternals = {
  getRelativeDirParts,
  computeDedupFolderKey,
  resolveFolderPathForJob,
  processItem,
  WORKER_ID,
  sanitize: sanitizeFilename,
};
