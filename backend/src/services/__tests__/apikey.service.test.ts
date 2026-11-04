/**
 * Phase 4 API-key service tests (no DB):
 *  - creation applies default scopes + expiry, returns only the raw key
 *  - rotation revokes the old key and re-issues one with the same scopes
 *  - the hashed key is never surfaced to callers
 */

jest.mock('../../config/env.config', () => ({ Env: { NODE_ENV: 'test' } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

jest.mock('../../models/apiKeys.model', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findByIdForUser: jest.fn(),
    revokeByIdForUser: jest.fn(),
  },
}));

import ApiKeyModel from '../../models/apiKeys.model';
import { createApiKeyService, rotateApiKeyService } from '../apikey.service';
import { DEFAULT_SCOPES } from '../../constant/scopes';

beforeEach(() => jest.clearAllMocks());

describe('createApiKeyService', () => {
  it('applies default scopes when none provided and returns only the raw key', async () => {
    (ApiKeyModel.create as jest.Mock).mockResolvedValue({});
    const res = await createApiKeyService('user-1', { name: 'ci key' });

    expect(res).toEqual({ rawKey: expect.stringMatching(/^sk_live_/) });
    // Never leaks the hashed key or other secrets to the caller.
    expect(Object.keys(res)).toEqual(['rawKey']);

    const arg = (ApiKeyModel.create as jest.Mock).mock.calls[0][0];
    expect(arg.scopes).toEqual(DEFAULT_SCOPES);
    expect(arg.hashedKey).toBeDefined();
    expect(arg.expiresAt).toBeNull();
  });

  it('honors explicit scopes and a positive expiry', async () => {
    (ApiKeyModel.create as jest.Mock).mockResolvedValue({});
    await createApiKeyService('user-1', { name: 'ro', scopes: ['files:read'], expiresInDays: 7 });
    const arg = (ApiKeyModel.create as jest.Mock).mock.calls[0][0];
    expect(arg.scopes).toEqual(['files:read']);
    expect(arg.expiresAt).toBeInstanceOf(Date);
    expect(arg.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('rotateApiKeyService', () => {
  it('revokes the old key then creates a replacement with the same scopes', async () => {
    (ApiKeyModel.findByIdForUser as jest.Mock).mockResolvedValue({
      _id: 'k1',
      name: 'ci key',
      scopes: ['files:read'],
      expiresAt: null,
    });
    (ApiKeyModel.revokeByIdForUser as jest.Mock).mockResolvedValue(true);
    (ApiKeyModel.create as jest.Mock).mockResolvedValue({});

    const res = await rotateApiKeyService('user-1', 'k1');
    expect(res.rawKey).toMatch(/^sk_live_/);
    expect(ApiKeyModel.revokeByIdForUser).toHaveBeenCalledWith('user-1', 'k1');
    const createdArg = (ApiKeyModel.create as jest.Mock).mock.calls[0][0];
    expect(createdArg.scopes).toEqual(['files:read']);
    expect(createdArg.name).toBe('ci key');
  });

  it('throws when the key does not belong to the user', async () => {
    (ApiKeyModel.findByIdForUser as jest.Mock).mockResolvedValue(null);
    await expect(rotateApiKeyService('user-1', 'missing')).rejects.toThrow(/not found/i);
  });
});
