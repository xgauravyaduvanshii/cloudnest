/**
 * Integration tests (mocked googleapis) for the Google Drive provider's
 * fixed-folder upload modes and rate-limit/quota error handling.
 *
 * Encodes Phase 1 requirements:
 *   2. FLAT drops files into the exact providerFolderId and never recreates a
 *      same-name root folder; PRESERVE_STRUCTURE rebuilds the chain only inside
 *      the selected folder via the race-safe folder cache.
 *   3. Quota (403 quotaExceeded) and rate-limit (429 / rateLimitExceeded) errors
 *      bubble up WITHOUT being treated as auth failures — no token wipe, no refresh.
 *   5. Large files stream (media.body is a Readable) instead of being buffered.
 */

import { Readable } from 'stream';
import { GoogleDriveStorageProvider } from '../google-drive.provider';
import { StorageAccountDocument } from '../../models/storage-account.model';
import StorageAccountModel from '../../models/storage-account.model';
import DriveFolderCacheModel from '../../models/drive-folder-cache.model';
import { google } from 'googleapis';
import { decryptJson } from '../../utils/crypto';

jest.mock('../../config/env.config', () => ({
  Env: {
    GOOGLE_CLIENT_ID: 'test-client-id',
    GOOGLE_CLIENT_SECRET: 'test-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
    DATABASE_URL: 'postgresql://test',
    JWT_SECRET: 'test-secret',
    PORT: 3000,
  },
}));

jest.mock('googleapis');
jest.mock('../../utils/crypto');
jest.mock('../../models/storage-account.model');
jest.mock('../../models/provider-settings.model');
jest.mock('../../models/drive-folder-cache.model', () => ({
  __esModule: true,
  default: { ensure: jest.fn() },
}));

describe('Google Drive fixed-folder upload modes', () => {
  let provider: GoogleDriveStorageProvider;
  let mockOAuth2Client: any;
  let mockDrive: any;

  const validAccount = (overrides: Record<string, unknown> = {}) =>
    ({
      _id: 'acct-1',
      id: 'acct-1',
      userId: 'user-1',
      provider: 'GOOGLE_DRIVE',
      displayName: 'My Drive',
      encryptedCredentials: 'encrypted-creds',
      rootFolderId: 'my-root-folder',
      status: 'ACTIVE',
      ...overrides,
    }) as unknown as StorageAccountDocument;

  const multerFile = (overrides: Record<string, unknown> = {}) =>
    ({
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: 11,
      buffer: Buffer.from('png bytes!!'),
      path: '',
      ...overrides,
    }) as unknown as Express.Multer.File;

  const createResult = (id: string) => ({
    data: { id, name: 'photo.png', mimeType: 'image/png' },
  });

  const httpError = (status: number, reason?: string) => {
    const error: any = new Error(`drive http ${status}`);
    error.response = {
      status,
      data: reason ? { error: { errors: [{ reason }] } } : undefined,
      headers: {},
    };
    return error;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new GoogleDriveStorageProvider();

    mockOAuth2Client = {
      setCredentials: jest.fn(),
      getAccessToken: jest.fn(),
      credentials: {
        access_token: 'valid-access-token',
        expiry_date: Date.now() + 3_600_000, // still valid; no proactive refresh
      },
    };

    mockDrive = {
      files: {
        list: jest.fn(),
        get: jest.fn(),
        create: jest.fn().mockResolvedValue(createResult('remote-file-1')),
        delete: jest.fn(),
        update: jest.fn(),
      },
      about: { get: jest.fn() },
    };

    (google.auth.OAuth2 as any) = jest.fn(() => mockOAuth2Client);
    (google.drive as any) = jest.fn(() => mockDrive);

    // Healthy, non-expired cached token so getDrive never needs to refresh.
    (decryptJson as jest.Mock).mockReturnValue({
      refreshToken: 'refresh-token',
      accessToken: 'valid-access-token',
      expiryDate: Date.now() + 3_600_000,
    });
  });

  it('FLAT uploads into the exact providerFolderId and creates no new folder', async () => {
    const result = await provider.upload(
      validAccount(),
      'user-1',
      multerFile(),
      { providerFolderId: 'exact-folder-abc', mode: 'FLAT' },
    );

    // The file is the only files.create call; no folder of the same name is created.
    expect(mockDrive.files.create).toHaveBeenCalledTimes(1);
    const createArgs = mockDrive.files.create.mock.calls[0][0];
    expect(createArgs.requestBody.parents).toEqual(['exact-folder-abc']);
    expect(createArgs.requestBody.mimeType).toBeUndefined();
    // The race-safe folder cache is never consulted in FLAT mode.
    expect(DriveFolderCacheModel.ensure).not.toHaveBeenCalled();
    expect(result.providerFileId).toBe('remote-file-1');
    expect(result.metadata.folderId).toBe('exact-folder-abc');
  });

  it('streams the body (Readable) rather than passing a raw buffer', async () => {
    await provider.upload(validAccount(), 'user-1', multerFile(), {
      providerFolderId: 'exact-folder-abc',
      mode: 'FLAT',
    });

    const createArgs = mockDrive.files.create.mock.calls[0][0];
    expect(createArgs.media.body).toBeInstanceOf(Readable);
    expect(Buffer.isBuffer(createArgs.media.body)).toBe(false);
  });

  it('PRESERVE_STRUCTURE rebuilds the chain inside the selected folder via the cache', async () => {
    // The cache resolves each segment to a folder id.
    (DriveFolderCacheModel.ensure as jest.Mock)
      .mockResolvedValueOnce('sub-a-id')
      .mockResolvedValueOnce('sub-b-id');

    await provider.upload(validAccount(), 'user-1', multerFile(), {
      providerFolderId: 'target-root',
      mode: 'PRESERVE_STRUCTURE',
      folderPath: ['a', 'b'],
    });

    // Two segments => two race-safe ensure() calls, each rooted at the selected folder chain.
    expect(DriveFolderCacheModel.ensure).toHaveBeenCalledTimes(2);
    expect((DriveFolderCacheModel.ensure as jest.Mock).mock.calls[0][0]).toMatchObject({
      parentFolderId: 'target-root',
      name: 'a',
    });
    expect((DriveFolderCacheModel.ensure as jest.Mock).mock.calls[1][0]).toMatchObject({
      parentFolderId: 'sub-a-id',
      name: 'b',
    });

    // The file lands in the deepest ensured folder — no duplicate root folder created.
    const createArgs = mockDrive.files.create.mock.calls[0][0];
    expect(createArgs.requestBody.parents).toEqual(['sub-b-id']);
  });

  it('does NOT wipe credentials or refresh on a quota 403 (bubbles up unchanged)', async () => {
    mockDrive.files.create.mockRejectedValueOnce(httpError(403, 'quotaExceeded'));

    await expect(
      provider.upload(validAccount(), 'user-1', multerFile(), {
        providerFolderId: 'exact-folder-abc',
        mode: 'FLAT',
      }),
    ).rejects.toMatchObject({ response: { status: 403 } });

    // Quota errors must not be mistaken for auth failures.
    expect(StorageAccountModel.updateCredentials).not.toHaveBeenCalled();
    expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
  });

  it('does NOT wipe credentials or refresh on a 429 rate limit (bubbles up unchanged)', async () => {
    mockDrive.files.create.mockRejectedValueOnce(httpError(429));

    await expect(
      provider.upload(validAccount(), 'user-1', multerFile(), {
        providerFolderId: 'exact-folder-abc',
        mode: 'FLAT',
      }),
    ).rejects.toBeDefined();

    expect(StorageAccountModel.updateCredentials).not.toHaveBeenCalled();
    expect(mockOAuth2Client.getAccessToken).not.toHaveBeenCalled();
  });

  it('wipes cached tokens and retries exactly once on an auth (401) error', async () => {
    mockDrive.files.create
      .mockRejectedValueOnce(httpError(401))
      .mockResolvedValueOnce(createResult('remote-after-refresh'));

    const result = await provider.upload(validAccount(), 'user-1', multerFile(), {
      providerFolderId: 'exact-folder-abc',
      mode: 'FLAT',
    });

    // An AUTH error is the ONLY classification that clears stored credentials,
    // and the operation is retried once (the file upload is attempted a second time).
    expect(StorageAccountModel.updateCredentials).toHaveBeenCalled();
    expect(mockDrive.files.create).toHaveBeenCalledTimes(2);
    expect(result.providerFileId).toBe('remote-after-refresh');
  });
});
