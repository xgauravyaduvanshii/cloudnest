/**
 * Unit tests for Phase 2 sharing enforcement (no live DB).
 * Verifies access rules and download-limit semantics in shares.service:
 *   - resolveShareService blocks inactive/expired links and wrong passwords
 *   - resolveShareService records a view and returns the resource payload
 *   - consumeShareDownloadService blocks view-only links, exhausted limits,
 *     and files outside the shared resource, and succeeds otherwise
 */

jest.mock('../../config/env.config', () => ({
  Env: { CLIENT_URL: 'https://app.test', NODE_ENV: 'test' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/bcrypt', () => ({
  hashValue: jest.fn(async (v: string) => `hash:${v}`),
  compareValue: jest.fn(async (value: string, hash: string) => hash === `hash:${value}`),
}));

jest.mock('../../models/share.model', () => ({
  __esModule: true,
  default: {
    findByToken: jest.fn(),
    incrementViewCount: jest.fn(),
    consumeDownloadSlot: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: { findById: jest.fn(), findAllByUser: jest.fn(), findByIdsForUser: jest.fn() },
  UploadSourceEnum: { WEB: 'WEB', API: 'API' },
}));

jest.mock('../../models/folder.model', () => ({
  __esModule: true,
  default: { findByIdForUser: jest.fn() },
}));

jest.mock('../../models/collection.model', () => ({
  __esModule: true,
  default: { findByIdForUser: jest.fn(), findItemIds: jest.fn() },
}));

jest.mock('../../models/activity.model', () => ({
  __esModule: true,
  default: {
    record: jest.fn().mockResolvedValue(null),
    recordShareAudit: jest.fn().mockResolvedValue(null),
    listShareAudit: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../files.service', () => ({
  toPublicFile: jest.fn((file: { _id: string; originalName?: string }) => ({
    id: file._id,
    name: file.originalName,
  })),
}));

import ShareModel from '../../models/share.model';
import FileModel from '../../models/file.model';
import ActivityModel from '../../models/activity.model';
import {
  consumeShareDownloadService,
  createShareService,
  resolveShareService,
} from '../shares.service';

const ctx = { ipAddress: '1.2.3.4', userAgent: 'jest' };

const baseShare = (overrides: Record<string, unknown> = {}) => ({
  _id: 'share-1',
  id: 'share-1',
  userId: 'user-1',
  resourceType: 'file',
  resourceId: 'file-1',
  token: 'abc123456',
  visibility: 'PUBLIC',
  permission: 'download',
  hasPassword: false,
  passwordHash: null,
  expiresAt: null,
  maxDownloads: null,
  downloadCount: 0,
  viewCount: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resolveShareService access enforcement', () => {
  it('rejects an inactive link and audits the denial', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare({ isActive: false }));
    await expect(resolveShareService('abc123456', undefined, ctx)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(ActivityModel.recordShareAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'access_denied', metadata: { reason: 'inactive' } }),
    );
  });

  it('rejects an expired link', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(
      baseShare({ expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(resolveShareService('abc123456', undefined, ctx)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('requires the correct password before returning the resource', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(
      baseShare({ hasPassword: true, passwordHash: 'hash:s3cret' }),
    );
    (ShareModel.incrementViewCount as jest.Mock).mockResolvedValue(baseShare({ hasPassword: true }));
    (FileModel.findById as jest.Mock).mockResolvedValue({ _id: 'file-1', originalName: 'a.txt' });

    await expect(resolveShareService('abc123456', 'wrong', ctx)).rejects.toMatchObject({
      statusCode: 403,
    });

    const ok = await resolveShareService('abc123456', 's3cret', ctx);
    expect(ok.resourceType).toBe('file');
    expect(ok.files).toHaveLength(1);
  });

  it('increments the view count for a valid public link', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare());
    (ShareModel.incrementViewCount as jest.Mock).mockResolvedValue(baseShare({ viewCount: 1 }));
    (FileModel.findById as jest.Mock).mockResolvedValue({ _id: 'file-1', originalName: 'a.txt' });

    const res = await resolveShareService('abc123456', undefined, ctx);
    expect(ShareModel.incrementViewCount).toHaveBeenCalledWith('share-1');
    expect(res.share.url).toContain('/share/abc123456');
  });
});

describe('consumeShareDownloadService limit + permission enforcement', () => {
  it('blocks downloads for view-only shares', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare({ permission: 'view' }));
    await expect(
      consumeShareDownloadService('abc123456', undefined, 'file-1', ctx),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks when the download limit is exhausted', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare());
    (ShareModel.consumeDownloadSlot as jest.Mock).mockResolvedValue(null);
    await expect(
      consumeShareDownloadService('abc123456', undefined, 'file-1', ctx),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('blocks a file that is not part of the shared resource', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare({ resourceId: 'other-file' }));
    (ShareModel.consumeDownloadSlot as jest.Mock).mockResolvedValue(baseShare());
    await expect(
      consumeShareDownloadService('abc123456', undefined, 'file-1', ctx),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it('returns the file name when a slot is granted', async () => {
    (ShareModel.findByToken as jest.Mock).mockResolvedValue(baseShare());
    (ShareModel.consumeDownloadSlot as jest.Mock).mockResolvedValue(
      baseShare({ downloadCount: 1 }),
    );
    (FileModel.findById as jest.Mock).mockResolvedValue({ _id: 'file-1', originalName: 'report.pdf' });
    const out = await consumeShareDownloadService('abc123456', undefined, 'file-1', ctx);
    expect(out).toMatchObject({ fileId: 'file-1', filename: 'report.pdf' });
  });
});

describe('createShareService', () => {
  it('hashes the password and returns a public share (no hash exposed)', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue({ _id: 'file-1', userId: 'user-1' });
    (ShareModel.create as jest.Mock).mockResolvedValue(
      baseShare({ hasPassword: true, passwordHash: 'hash:s3cret' }),
    );

    const share = await createShareService('user-1', {
      resourceType: 'file',
      resourceId: 'file-1',
      password: 's3cret',
      permission: 'download',
    });
    expect(share).not.toHaveProperty('passwordHash');
    expect((share as Record<string, unknown>).hasPassword).toBe(true);
    expect(share.url).toContain('/share/');
  });
});
