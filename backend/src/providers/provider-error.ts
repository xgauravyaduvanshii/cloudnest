/**
 * Provider-agnostic error classification used by the upload worker to decide
 * whether an upload failure is retryable and how long to wait before retrying.
 *
 * The Google Drive provider (and any future provider) throws raw upstream errors;
 * we classify them here so the worker never confuses a rate-limit/quota error with
 * an OAuth authentication problem (which would wrongly wipe cached tokens).
 */

export type ProviderErrorKind =
  | 'AUTH'
  | 'RATE_LIMIT'
  | 'QUOTA'
  | 'TRANSIENT'
  | 'CLIENT'
  | 'UNKNOWN';

export interface ClassifiedError {
  kind: ProviderErrorKind;
  retryable: boolean;
  status?: number;
  reason?: string;
  /** When known (Retry-After header / Google retry hint), the requested delay in ms. */
  retryAfterMs?: number;
}

/** Rate-limit / quota reasons returned by the Google Drive API in error.errors[].reason. */
const RATE_LIMIT_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
]);
const QUOTA_REASONS = new Set([
  'quotaExceeded',
  'storageQuotaExceeded',
  'userRateLimitExceeded',
]);
/** 403 reasons that genuinely mean the token/credential is bad and may be refreshed. */
const AUTH_REASONS = new Set([
  'authError',
  'invalid',
  'invalid_client',
  'unauthorized',
]);

const parseRetryAfterMs = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 1000));
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return Math.max(0, Math.round(seconds * 1000));
    }
    const date = Date.parse(value);
    if (!Number.isNaN(date)) {
      return Math.max(0, date - Date.now());
    }
  }
  return undefined;
};

const getStatus = (error: any): number | undefined => {
  const status =
    error?.response?.status ??
    error?.$metadata?.httpStatusCode ??
    error?.status ??
    error?.code;
  return typeof status === 'number' ? status : undefined;
};

const getReason = (error: any): string | undefined => {
  const reason =
    error?.response?.data?.error?.errors?.[0]?.reason ??
    error?.errors?.[0]?.reason ??
    error?.response?.data?.error?.status ??
    error?.code;
  return typeof reason === 'string' ? reason : undefined;
};

export const classifyDriveError = (error: any): ClassifiedError => {
  const status = getStatus(error);
  const reason = getReason(error);
  const retryAfterMs = parseRetryAfterMs(
    error?.response?.headers?.['retry-after'] ?? error?.response?.headers?.['Retry-After'],
  );

  if (status === 429) {
    return { kind: 'RATE_LIMIT', retryable: true, status, reason, retryAfterMs };
  }

  if (status === 403) {
    if (reason && QUOTA_REASONS.has(reason)) {
      return { kind: 'QUOTA', retryable: true, status, reason, retryAfterMs };
    }
    if (reason && RATE_LIMIT_REASONS.has(reason)) {
      return { kind: 'RATE_LIMIT', retryable: true, status, reason, retryAfterMs };
    }
    // A 403 with no recognizable rate/quota reason is ambiguous; treat as auth only
    // when the reason is explicitly auth-related. Otherwise surface as non-retryable
    // client error so we never clear a good cached token on an unknown 403.
    if (reason && AUTH_REASONS.has(reason)) {
      return { kind: 'AUTH', retryable: true, status, reason };
    }
    return { kind: 'CLIENT', retryable: false, status, reason };
  }

  if (status === 401) {
    return { kind: 'AUTH', retryable: true, status, reason };
  }

  if (status === 408 || status === 429 || (status && status >= 500)) {
    return { kind: 'TRANSIENT', retryable: true, status, reason, retryAfterMs };
  }

  if (status && status >= 400 && status < 500) {
    return { kind: 'CLIENT', retryable: false, status, reason };
  }

  // Connection resets, DNS blips, aborted requests, etc. carry no HTTP status.
  const code = typeof error?.code === 'string' ? error.code : undefined;
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED'
  ) {
    return { kind: 'TRANSIENT', retryable: true, reason: code };
  }

  return { kind: 'UNKNOWN', retryable: false, status, reason };
};

/**
 * Exponential backoff with full jitter. When the provider supplied a Retry-After
 * hint we honor it (clamped to [minDelayMs, maxDelayMs]) instead of the computed base.
 */
export const computeBackoffDelayMs = (
  attempt: number,
  opts: {
    baseMs?: number;
    factor?: number;
    maxMs?: number;
    retryAfterMs?: number;
  } = {},
): number => {
  const baseMs = opts.baseMs ?? 500;
  const factor = opts.factor ?? 2;
  const maxMs = opts.maxMs ?? 60_000;
  if (opts.retryAfterMs && opts.retryAfterMs > 0) {
    return Math.min(maxMs, Math.max(baseMs, opts.retryAfterMs));
  }
  const exponential = Math.min(maxMs, baseMs * Math.pow(factor, Math.max(0, attempt)));
  // Full jitter: uniformly sample in [baseMs/2, exponential].
  const low = Math.min(baseMs / 2, exponential);
  return Math.round(low + Math.random() * (exponential - low));
};

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));
