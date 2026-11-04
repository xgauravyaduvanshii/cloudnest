import {
  classifyDriveError,
  computeBackoffDelayMs,
} from '../provider-error';

const gaxiosLike = (
  status: number,
  reason?: string,
  extra: Record<string, unknown> = {},
) => {
  const error: any = new Error(`drive error ${status}`);
  error.response = {
    status,
    data: reason ? { error: { errors: [{ reason }] } } : undefined,
    headers: (extra.headers as any) || {},
  };
  if (extra.code) error.code = extra.code;
  return error;
};

describe('classifyDriveError', () => {
  it('classifies 429 as a retryable rate limit', () => {
    const result = classifyDriveError(gaxiosLike(429));
    expect(result.kind).toBe('RATE_LIMIT');
    expect(result.retryable).toBe(true);
  });

  it('classifies rateLimitExceeded 403 as retryable rate limit (NOT auth)', () => {
    const result = classifyDriveError(gaxiosLike(403, 'rateLimitExceeded'));
    expect(result.kind).toBe('RATE_LIMIT');
    expect(result.retryable).toBe(true);
  });

  it('classifies quotaExceeded 403 as retryable quota (NOT auth)', () => {
    const result = classifyDriveError(gaxiosLike(403, 'quotaExceeded'));
    expect(result.kind).toBe('QUOTA');
    expect(result.retryable).toBe(true);
  });

  it('honors Retry-After headers (seconds)', () => {
    const result = classifyDriveError(
      gaxiosLike(429, undefined, { headers: { 'retry-after': '7' } }),
    );
    expect(result.retryAfterMs).toBe(7000);
  });

  it('treats an auth-related 403 reason as an auth error', () => {
    const result = classifyDriveError(gaxiosLike(403, 'authError'));
    expect(result.kind).toBe('AUTH');
    expect(result.retryable).toBe(true);
  });

  it('treats an unknown 403 as a non-retryable client error (never clears a good token)', () => {
    const result = classifyDriveError(gaxiosLike(403, 'somePermissionIssue'));
    expect(result.kind).toBe('CLIENT');
    expect(result.retryable).toBe(false);
  });

  it('classifies 401 as auth', () => {
    expect(classifyDriveError(gaxiosLike(401)).kind).toBe('AUTH');
  });

  it('classifies 5xx as retryable transient', () => {
    const result = classifyDriveError(gaxiosLike(503));
    expect(result.kind).toBe('TRANSIENT');
    expect(result.retryable).toBe(true);
  });

  it('classifies 404 as non-retryable client error', () => {
    const result = classifyDriveError(gaxiosLike(404));
    expect(result.kind).toBe('CLIENT');
    expect(result.retryable).toBe(false);
  });

  it('classifies connection errors without a status as transient', () => {
    const error: any = new Error('socket hang up');
    error.code = 'ECONNRESET';
    const result = classifyDriveError(error);
    expect(result.kind).toBe('TRANSIENT');
    expect(result.retryable).toBe(true);
  });

  it('reads AWS SDK $metadata.httpStatusCode', () => {
    const error: any = new Error('SlowDown');
    error.$metadata = { httpStatusCode: 503 };
    const result = classifyDriveError(error);
    expect(result.retryable).toBe(true);
  });
});

describe('computeBackoffDelayMs', () => {
  it('honors a Retry-After hint within clamp bounds', () => {
    const delay = computeBackoffDelayMs(0, { retryAfterMs: 4000, maxMs: 30_000 });
    expect(delay).toBe(4000);
  });

  it('clamps Retry-After to the configured maximum', () => {
    const delay = computeBackoffDelayMs(0, { retryAfterMs: 900_000, maxMs: 30_000 });
    expect(delay).toBe(30_000);
  });

  it('grows exponentially with attempt count', () => {
    const first = computeBackoffDelayMs(0, { baseMs: 500, maxMs: 60_000 });
    // attempt 5 should be capped near max, always larger than the first attempt
    const later = computeBackoffDelayMs(5, { baseMs: 500, maxMs: 60_000 });
    expect(later).toBeGreaterThanOrEqual(first);
    expect(later).toBeLessThanOrEqual(60_000);
  });

  it('stays within bounds across many randomized attempts', () => {
    for (let i = 0; i < 200; i++) {
      const delay = computeBackoffDelayMs(i % 8, { baseMs: 500, maxMs: 60_000 });
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(60_000);
    }
  });
});
