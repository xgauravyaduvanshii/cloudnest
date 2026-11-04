/**
 * Unit tests for Phase 2 collections (many-to-many grouping, no file moves) (no live DB).
 *   - create rejects a duplicate name for the same user (409)
 *   - create persists only the files the user actually owns
 *   - add/remove filter membership through the model layer
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

jest.mock('../../models/collection.model', () => {
  const model = {
    create: jest.fn(),
    findByIdForUser: jest.fn(),
    findByNameForUser: jest.fn(),
    findAllForUser: jest.fn(),
    findItemIds: jest.fn().mockResolvedValue([]),
    addItems: jest.fn().mockResolvedValue(0),
    removeItems: jest.fn().mockResolvedValue(0),
    update: jest.fn(),
    deleteByIdForUser: jest.fn(),
  };
  return { __esModule: true, default: model };
});

jest.mock('../../models/file.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findByIdsForUser: jest.fn(),
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

import CollectionModel from '../../models/collection.model';
import FileModel from '../../models/file.model';
import {
  addFilesToCollectionService,
  createCollectionService,
} from '../collections.service';

const collection = (overrides: Record<string, unknown> = {}) => ({
  _id: 'col-1',
  id: 'col-1',
  userId: 'user-1',
  name: 'Photos',
  description: null,
  color: null,
  fileCount: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe('createCollectionService', () => {
  it('rejects a duplicate collection name for the same user', async () => {
    (CollectionModel.findByNameForUser as jest.Mock).mockResolvedValue(collection());
    await expect(
      createCollectionService('user-1', { name: 'Photos' }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(CollectionModel.create).not.toHaveBeenCalled();
  });

  it('persists only files the user owns', async () => {
    (CollectionModel.findByNameForUser as jest.Mock).mockResolvedValue(null);
    (CollectionModel.create as jest.Mock).mockResolvedValue(collection());
    // Requested 3 files but the user only owns 2 of them.
    (FileModel.findByIdsForUser as jest.Mock).mockResolvedValue([
      { _id: 'f1' },
      { _id: 'f2' },
    ]);
    (CollectionModel.addItems as jest.Mock).mockResolvedValue(2);

    await createCollectionService('user-1', {
      name: 'Photos',
      fileIds: ['f1', 'f2', 'f3-not-owned'],
    });

    expect(FileModel.findByIdsForUser).toHaveBeenCalledWith(
      ['f1', 'f2', 'f3-not-owned'],
      'user-1',
    );
    expect(CollectionModel.addItems).toHaveBeenCalledWith('col-1', ['f1', 'f2']);
  });
});

describe('addFilesToCollectionService', () => {
  it('adds only owned files to an existing collection', async () => {
    (CollectionModel.findByIdForUser as jest.Mock).mockResolvedValue(collection());
    (FileModel.findByIdsForUser as jest.Mock).mockResolvedValue([{ _id: 'f1' }]);
    await addFilesToCollectionService('user-1', 'col-1', ['f1', 'f2-missing']);
    expect(CollectionModel.addItems).toHaveBeenCalledWith('col-1', ['f1']);
  });

  it('throws when none of the requested files are valid', async () => {
    (CollectionModel.findByIdForUser as jest.Mock).mockResolvedValue(collection());
    (FileModel.findByIdsForUser as jest.Mock).mockResolvedValue([]);
    await expect(
      addFilesToCollectionService('user-1', 'col-1', ['missing']),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
