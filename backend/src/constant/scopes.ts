/**
 * Canonical API-key scopes. Keys are least-privilege by default: a scope must be
 * explicitly granted to allow a v1 operation. Webhook events are separate names.
 */
export const SCOPE = {
  FILES_READ: 'files:read',
  FILES_WRITE: 'files:write',
  UPLOAD_WRITE: 'upload:write',
  SHARE_WRITE: 'share:write',
} as const;

export type Scope = (typeof SCOPE)[keyof typeof SCOPE];

export const ALL_SCOPES: Scope[] = Object.values(SCOPE);

export const DEFAULT_SCOPES: Scope[] = [SCOPE.FILES_READ, SCOPE.FILES_WRITE, SCOPE.UPLOAD_WRITE];

export const isValidScope = (value: string): value is Scope =>
  (ALL_SCOPES as string[]).includes(value);

/** Webhook event names (grouped by domain). */
export const WEBHOOK_EVENTS = [
  'file.uploaded',
  'file.deleted',
  'share.created',
  'upload_job.completed',
  'upload_job.failed',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const isValidWebhookEvent = (value: string): value is WebhookEvent =>
  (WEBHOOK_EVENTS as readonly string[]).includes(value);
