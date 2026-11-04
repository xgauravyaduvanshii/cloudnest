/**
 * Unit tests for Phase 2 file version history (no live DB).
 *   - getVersionHistoryService enforces ownership and returns the version lineage
 *   - restoreFileVersionService copy-forwards a new latest version without mutating
 *     the original rows (version number = max + 1, group demoted, supersedes link)
 */

jest.mock('../../config/env.config', () => ({
  Env: { NODE_ENV: 'test', API_PUBLIC_URL: 'https://api.test' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../config/database.config', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((cb: (client: unknown) => Promise<unknown>) => cb({ query: jest.fn() })),
}));

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findVersionsByGroup: jest.fn(),
    getLatestVersionNumber: jest.fn(),
    clearGroupLatest: jest.fn(),
    setVersionGroup: jest.fn(),
    create: jest.fn(),
  },
  UploadSourceEnum: { WEB: 'WEB', API: 'API' },
}));

jest.mock('../../models/activity.model', () => ({
  __esModule: true,
  default: { record: jest.fn().mockResolvedValue(null) },
}));

jest.mock('../files.service', () => ({
  toPublicFile: jest.fn((file: { _id: string }) => ({ id: file._id })),
}));

import FileModel from '../../models/file.model';
import {
  getVersionHistoryService,
  restoreFileVersionService,
} from '../file-versions.service';

const makeVersion = (overrides: Record<string, unknown> = {}) => ({
  _id: 'file-1',
  id: 'file-1',
  userId: 'user-1',
  originalName: 'report.pdf',
  storageKey: 'key-1',
  provider: 'S3',
  storageAccountId: 'acct-1',
  folderId: null,
  providerFileId: 'pf-1',
  providerMetadata: {},
  mimeType: 'application/pdf',
  size: 100,
  ext: 'pdf',
  uploadVia: 'WEB',
  url: '',
  checksumSha256: 'sha-old',
  originalPath: null,
  providerFolderId: null,
  versionGroupId: 'group-1',
  supersedesFileId: null,
  versionNumber: 1,
  isLatest: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('getVersionHistoryService', () => {
  it('rejects access to a file owned by someone else', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(makeVersion({ userId: 'other' }));
    await expect(getVersionHistoryService('user-1', 'file-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('returns the full lineage for a versioned file', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(makeVersion());
    (FileModel.findVersionsByGroup as jest.Mock).mockResolvedValue([
      makeVersion({ _id: 'file-1', versionNumber: 1 }),
      makeVersion({ _id: 'file-2', versionNumber: 2, isLatest: true }),
    ]);
    const res = await getVersionHistoryService('user-1', 'file-1');
    expect(res.versionGroupId).toBe('group-1');
    expect(res.versions).toHaveLength(2);
    expect(FileModel.findVersionsByGroup).toHaveBeenCalledWith('user-1', 'group-1');
  });

  it('treats an unversioned file as its own single revision', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(
      makeVersion({ versionGroupId: null, _id: 'solo' }),
    );
    const res = await getVersionHistoryService('user-1', 'solo');
    expect(res.versions).toHaveLength(1);
    expect(FileModel.findVersionsByGroup).not.toHaveBeenCalled();
  });
});

describe('restoreFileVersionService (copy-forward)', () => {
  it('creates a new latest version and demotes the group without deleting originals', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(makeVersion({ versionNumber: 1 }));
    (FileModel.getLatestVersionNumber as jest.Mock).mockResolvedValue(3);
    (FileModel.create as jest.Mock).mockResolvedValue(
      makeVersion({ _id: 'file-new', versionNumber: 4, isLatest: true }),
    );

    const restored = await restoreFileVersionService('user-1', 'file-1');

    expect(FileModel.clearGroupLatest).toHaveBeenCalledWith('user-1', 'group-1', expect.anything());
    expect(FileModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        versionGroupId: 'group-1',
        supersedesFileId: 'file-1',
        versionNumber: 4,
        isLatest: true,
        storageKey: 'key-1',
        providerFileId: 'pf-1',
      }),
    );
    expect(restored).toBeTruthy();
  });

  it('bootstraps a version group when restoring a previously unversioned file', async () => {
    (FileModel.findById as jest.Mock).mockResolvedValue(
      makeVersion({ versionGroupId: null, _id: 'solo' }),
    );
    (FileModel.getLatestVersionNumber as jest.Mock).mockResolvedValue(1);
    (FileModel.create as jest.Mock).mockResolvedValue(makeVersion({ _id: 'file-new' }));

    await restoreFileVersionService('user-1', 'solo');

    expect(FileModel.setVersionGroup).toHaveBeenCalledWith('solo', 'solo', expect.anything());
  });
});
