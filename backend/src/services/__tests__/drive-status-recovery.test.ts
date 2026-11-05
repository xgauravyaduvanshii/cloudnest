/**
 * Regression tests for the Google Drive "auto-unauthorized" fix.
 *
 * Root cause: syncStorageAccountService used to flip an account to status='ERROR'
 * on ANY provider error, which then made every subsequent Drive read fail with a
 * generic 400 until an admin re-synced. These tests pin the corrected behavior:
 *   - transient / rate-limit / 5xx blips during sync do NOT downgrade the status
 *   - a genuine auth failure (401) DOES mark the account ERROR
 *   - a revoked grant surfaced as GOOGLE_REAUTH_REQUIRED (409) DOES mark ERROR
 *   - a successful sync resets an ERROR account back to ACTIVE
 */

jest.mock('../../config/env.config', () => ({
  Env: { JWT_SECRET: 'test', NODE_ENV: 'test', API_PUBLIC_URL: 'http://api.test' },
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../utils/crypto', () => ({
  encryptJson: jest.fn((v: unknown) => JSON.stringify(v)),
  decryptJson: jest.fn((v: string) => JSON.parse(v)),
}));

jest.mock('../../models/provider-settings.model', () => ({
  __esModule: true,
  default: { get: jest.fn(), findForAdmin: jest.fn(), findForUser: jest.fn() },
}));

jest.mock('../../providers/google-drive.provider', () => ({
  createGoogleOAuthClient: jest.fn(),
  GOOGLE_DRIVE_SCOPES: [],
}));

jest.mock('../../providers/telegram.provider', () => ({
  createTelegramClient: jest.fn(),
  getTelegramCredentials: jest.fn(),
}));

jest.mock('../../models/storage-account.model', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateUsage: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

jest.mock('../../providers', () => ({
  getStorageProvider: jest.fn(),
}));

import StorageAccountModel from '../../models/storage-account.model';
import { getStorageProvider } from '../../providers';
import { syncStorageAccountService } from '../storage-accounts.service';
import { ErrorCodeEnum } from '../../enums/error-code.enum';

const user = { _id: 'u1', role: 'USER' } as any;
const account = {
  id: 'acc1',
  _id: 'acc1',
  userId: 'u1',
  ownerType: 'USER',
  provider: 'GOOGLE_DRIVE',
  displayName: 'Drive',
  status: 'ACTIVE',
  encryptedCredentials: 'enc',
};

const httpError = (status: number) =>
  Object.assign(new Error(`http ${status}`), { response: { status } });

describe('syncStorageAccountService status handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (StorageAccountModel.findById as jest.Mock).mockResolvedValue({ ...account });
    (StorageAccountModel.updateStatus as jest.Mock).mockResolvedValue(undefined);
    (StorageAccountModel.updateUsage as jest.Mock).mockResolvedValue({ ...account, status: 'ACTIVE' });
  });

  it('does NOT downgrade status on a transient/5xx blip', async () => {
    (getStorageProvider as jest.Mock).mockReturnValue({
      syncUsage: jest.fn().mockRejectedValue(httpError(503)),
    });

    await expect(syncStorageAccountService('acc1', user)).rejects.toThrow();
    expect(StorageAccountModel.updateStatus).not.toHaveBeenCalled();
  });

  it('does NOT downgrade status on a rate-limit (429)', async () => {
    (getStorageProvider as jest.Mock).mockReturnValue({
      syncUsage: jest.fn().mockRejectedValue(httpError(429)),
    });

    await expect(syncStorageAccountService('acc1', user)).rejects.toThrow();
    expect(StorageAccountModel.updateStatus).not.toHaveBeenCalled();
  });

  it('DOES mark ERROR on a genuine auth failure (401)', async () => {
    (getStorageProvider as jest.Mock).mockReturnValue({
      syncUsage: jest.fn().mockRejectedValue(httpError(401)),
    });

    await expect(syncStorageAccountService('acc1', user)).rejects.toThrow();
    expect(StorageAccountModel.updateStatus).toHaveBeenCalledWith(
      'acc1',
      'ERROR',
      expect.any(String),
    );
  });

  it('DOES mark ERROR on a revoked grant (GOOGLE_REAUTH_REQUIRED 409)', async () => {
    const reauth = Object.assign(new Error('revoked'), {
      statusCode: 409,
      errorCode: ErrorCodeEnum.GOOGLE_REAUTH_REQUIRED,
    });
    (getStorageProvider as jest.Mock).mockReturnValue({
      syncUsage: jest.fn().mockRejectedValue(reauth),
    });

    await expect(syncStorageAccountService('acc1', user)).rejects.toThrow();
    expect(StorageAccountModel.updateStatus).toHaveBeenCalledWith(
      'acc1',
      'ERROR',
      'revoked',
    );
  });

  it('resets an ERROR account back to ACTIVE after a successful sync', async () => {
    (StorageAccountModel.findById as jest.Mock).mockResolvedValue({ ...account, status: 'ERROR' });
    (getStorageProvider as jest.Mock).mockReturnValue({
      syncUsage: jest.fn().mockResolvedValue({ usageBytes: 1, limitBytes: 2, details: {} }),
    });

    await syncStorageAccountService('acc1', user);
    expect(StorageAccountModel.updateUsage).toHaveBeenCalledWith(
      'acc1',
      expect.objectContaining({ status: 'ACTIVE', errorMessage: null }),
    );
  });
});
