/**
 * Unit tests for the upload worker's per-item processing pipeline.
 *
 * Drives __workerInternals.processItem with mocked models/providers to verify the
 * Phase 1 reliability behaviors without a live database:
 *   - exact-duplicate detection is SKIPPED (no remote upload)
 *   - VERSION conflict policy establishes lineage and supersedes the old file
 *   - RENAME conflict policy de-collides the target name before upload
 *   - retryable provider failures schedule backoff (markItemFailure with a delay)
 *   - non-retryable provider failures fail terminally (markItemFailure with null)
 */

jest.mock('../../config/env.config', () => ({
  Env: { NODE_ENV: 'test', UPLOAD_WORKER_CONCURRENCY: 4 },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/upload-source', () => ({
  computeFileSha256: jest.fn(),
  getUploadStream: jest.fn(() => ({ on: jest.fn() })),
}));

jest.mock('../../models/upload-job.model', () => {
  const model = {
    findById: jest.fn(),
    markItemFailure: jest.fn(),
    markItemSkipped: jest.fn(),
    markItemUploaded: jest.fn(),
    setItemChecksum: jest.fn(),
    addProcessedBytes: jest.fn(),
  };
  return { __esModule: true, default: model, UploadJobModel: model };
});

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: {
    findExactDuplicate: jest.fn(),
    findLatestByName: jest.fn(),
    create: jest.fn(),
    setVersionGroup: jest.fn(),
    markNotLatest: jest.fn(),
  },
  UploadSourceEnum: { WEB: 'WEB', API: 'API' },
}));

jest.mock('../../models/folder.model', () => ({
  __esModule: true,
  default: { findPath: jest.fn() },
}));

jest.mock('../../models/storage-account.model', () => ({
  __esModule: true,
  default: { findById: jest.fn(), updateUsage: jest.fn() },
}));

jest.mock('../../providers', () => ({
  getStorageProvider: jest.fn(),
}));

import { computeFileSha256 } from '../../utils/upload-source';
import UploadJobModel from '../../models/upload-job.model';
import FileModel from '../../models/file.model';
import StorageAccountModel from '../../models/storage-account.model';
import { getStorageProvider } from '../../providers';
import { __workerInternals } from '../upload-jobs.worker';

const { processItem } = __workerInternals;

const buildJob = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'job-1',
    userId: 'user-1',
    storageAccountId: 'acct-1',
    provider: 'GOOGLE_DRIVE',
    status: 'PROCESSING',
    mode: 'FLAT',
    conflictPolicy: 'VERSION',
    folderId: null,
    providerFolderId: 'gdrive-folder-1',
    ...overrides,
  }) as any;

const buildItem = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'item-1',
    jobId: 'job-1',
    itemIndex: 0,
    status: 'UPLOADING',
    originalName: 'report.pdf',
    relativePath: null,
    ext: 'pdf',
    mimeType: 'application/pdf',
    size: 1234,
    checksumSha256: null,
    storageTmpPath: '/tmp/cloudnest-item-1',
    attemptCount: 1,
    maxAttempts: 5,
    ...overrides,
  }) as any;

const account = { id: 'acct-1', provider: 'GOOGLE_DRIVE' } as any;

const providerUploadResult = {
  storageKey: 'keys/report.pdf',
  providerFileId: 'remote-file-1',
  metadata: { folderId: 'gdrive-folder-1' },
};

const httpError = (status: number, reason?: string) => {
  const error: any = new Error(`drive http ${status}`);
  error.response = {
    status,
    data: reason ? { error: { errors: [{ reason }] } } : undefined,
    headers: {},
  };
  return error;
};

// A single, stable provider instance is returned by getStorageProvider for every call.
let mockProvider: any;

beforeEach(() => {
  jest.clearAllMocks();
  mockProvider = {
    upload: jest.fn().mockResolvedValue(providerUploadResult),
    syncUsage: jest
      .fn()
      .mockResolvedValue({ usageBytes: 0, limitBytes: null, details: {} }),
  };
  (getStorageProvider as jest.Mock).mockReturnValue(mockProvider);
  (StorageAccountModel.findById as jest.Mock).mockResolvedValue(account);
  (UploadJobModel.findById as jest.Mock).mockResolvedValue(buildJob());
  (computeFileSha256 as jest.Mock).mockResolvedValue('newhash');
  (FileModel.create as jest.Mock).mockResolvedValue({ id: 'file-new' });
});

describe('upload worker processItem', () => {
  it('skips an exact duplicate without calling the provider', async () => {
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue({
      id: 'file-existing',
      providerFileId: 'remote-existing',
    });

    await processItem(buildItem());

    expect(mockProvider.upload).not.toHaveBeenCalled();
    expect(UploadJobModel.markItemSkipped).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ fileId: 'file-existing' }),
    );
    expect(UploadJobModel.addProcessedBytes).toHaveBeenCalledWith('job-1', 1234);
    expect(UploadJobModel.setItemChecksum).toHaveBeenCalledWith('item-1', 'newhash');
  });

  it('applies the VERSION conflict policy and supersedes the prior file', async () => {
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue(null);
    (FileModel.findLatestByName as jest.Mock).mockResolvedValue({
      id: 'file-old',
      checksumSha256: 'differenthash',
      versionGroupId: null,
      versionNumber: 1,
      providerFileId: 'remote-old',
    });

    await processItem(buildItem());

    expect(mockProvider.upload).toHaveBeenCalledTimes(1);
    expect(FileModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        versionNumber: 2,
        supersedesFileId: 'file-old',
        versionGroupId: 'file-old',
        isLatest: true,
      }),
    );
    expect(FileModel.markNotLatest).toHaveBeenCalledWith('file-old');
    expect(FileModel.setVersionGroup).not.toHaveBeenCalled();
    expect(UploadJobModel.markItemUploaded).toHaveBeenCalledWith(
      'item-1',
      expect.objectContaining({ fileId: 'file-new' }),
    );
  });

  it('applies the RENAME conflict policy and de-collides the name', async () => {
    (UploadJobModel.findById as jest.Mock).mockResolvedValue(
      buildJob({ conflictPolicy: 'RENAME' }),
    );
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue(null);
    (FileModel.findLatestByName as jest.Mock).mockImplementation(
      async ({ originalName }: { originalName: string }) =>
        originalName === 'report.pdf'
          ? { id: 'file-old', checksumSha256: 'differenthash', versionNumber: 1 }
          : null,
    );

    await processItem(buildItem());

    expect(mockProvider.upload).toHaveBeenCalledWith(
      account,
      'user-1',
      expect.objectContaining({ originalname: 'report (1).pdf' }),
      expect.anything(),
    );
    expect(FileModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ originalName: 'report (1).pdf', versionNumber: 1 }),
    );
  });

  it('schedules backoff when a retryable (429) provider error occurs', async () => {
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue(null);
    (FileModel.findLatestByName as jest.Mock).mockResolvedValue(null);
    (mockProvider.upload as jest.Mock).mockRejectedValue(httpError(429));

    await processItem(buildItem());

    expect(UploadJobModel.markItemUploaded).not.toHaveBeenCalled();
    const failureCall = (UploadJobModel.markItemFailure as jest.Mock).mock.calls[0];
    expect(failureCall[0]).toBe('item-1');
    expect(typeof failureCall[2]).toBe('number');
    expect(failureCall[2]).toBeGreaterThan(0);
  });

  it('fails terminally on a non-retryable client error (no backoff)', async () => {
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue(null);
    (FileModel.findLatestByName as jest.Mock).mockResolvedValue(null);
    (mockProvider.upload as jest.Mock).mockRejectedValue(
      httpError(403, 'somePermissionIssue'),
    );

    await processItem(buildItem());

    const failureCall = (UploadJobModel.markItemFailure as jest.Mock).mock.calls[0];
    expect(failureCall[2]).toBeNull();
  });

  it('passes providerFolderId and FLAT mode through to the provider', async () => {
    (FileModel.findExactDuplicate as jest.Mock).mockResolvedValue(null);
    (FileModel.findLatestByName as jest.Mock).mockResolvedValue(null);

    await processItem(buildItem());

    expect(mockProvider.upload).toHaveBeenCalledWith(
      account,
      'user-1',
      expect.anything(),
      expect.objectContaining({
        providerFolderId: 'gdrive-folder-1',
        mode: 'FLAT',
      }),
    );
  });
});
