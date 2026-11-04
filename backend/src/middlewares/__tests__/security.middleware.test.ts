/**
 * Phase 4 security/scope tests (no DB, no network).
 */

jest.mock('../../config/env.config', () => ({ Env: { NODE_ENV: 'test', API_RATE_LIMIT_PER_MIN: '2' } }));
jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { requireScopes, requireApiKey } from '../../middlewares/require-scope.middleware';
import { createRateLimit } from '../../middlewares/rate-limit.middleware';
import { isValidScope, isValidWebhookEvent, SCOPE, WEBHOOK_EVENTS } from '../../constant/scopes';

const mockReq = (apiKey?: any) => ({ apiKey, method: 'GET', url: '/x', ip: '1.2.3.4' } as any);
const mockRes = () => ({}) as any;

describe('requireScopes', () => {
  it('passes through for non-API-key (JWT) requests', () => {
    const next = jest.fn();
    requireScopes(SCOPE.FILES_READ)(mockReq(undefined), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('allows when the key has the required scope', () => {
    const next = jest.fn();
    requireScopes(SCOPE.FILES_WRITE)(mockReq({ id: 'k', scopes: ['files:write'] }), mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('forwards a Forbidden error when a scope is missing', () => {
    const next = jest.fn();
    requireScopes(SCOPE.FILES_WRITE, SCOPE.UPLOAD_WRITE)(
      mockReq({ id: 'k', scopes: ['files:read'] }),
      mockRes(),
      next,
    );
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain('files:write');
  });
});

describe('requireApiKey', () => {
  it('rejects when there is no API key on the request', () => {
    const next = jest.fn();
    requireApiKey(mockReq(undefined), mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});

describe('createRateLimit', () => {
  it('allows up to max then throws 429', () => {
    const store = new Map();
    const mw = createRateLimit({ windowMs: 1000, max: 2, store, keyFn: () => 'u' });
    const next1 = jest.fn();
    const next2 = jest.fn();
    const next3 = jest.fn();
    mw(mockReq(), mockRes(), next1);
    mw(mockReq(), mockRes(), next2);
    mw(mockReq(), mockRes(), next3);
    expect(next1).toHaveBeenCalledWith();
    expect(next2).toHaveBeenCalledWith();
    expect(next3.mock.calls[0][0].statusCode).toBe(429);
  });

  it('resets after the window elapses', () => {
    const store = new Map();
    let now = 1000;
    const realNow = Date.now;
    Date.now = () => now;
    const mw = createRateLimit({ windowMs: 500, max: 1, store, keyFn: () => 'u' });
    mw(mockReq(), mockRes(), jest.fn());
    const over = jest.fn();
    mw(mockReq(), mockRes(), over);
    expect(over.mock.calls[0][0].statusCode).toBe(429);
    now += 501; // window passed
    const afterReset = jest.fn();
    mw(mockReq(), mockRes(), afterReset);
    expect(afterReset).toHaveBeenCalledWith();
    Date.now = realNow;
  });
});

describe('scope/event validators', () => {
  it('accepts known scopes and rejects unknown', () => {
    expect(isValidScope('files:read')).toBe(true);
    expect(isValidScope('admin:everything')).toBe(false);
  });

  it('accepts known webhook events and rejects unknown', () => {
    expect(isValidWebhookEvent(WEBHOOK_EVENTS[0])).toBe(true);
    expect(isValidWebhookEvent('file.exploded')).toBe(false);
  });
});
