import crypto from 'crypto';
import ShareModel, {
  ShareDocument,
  SharePermission,
  ShareResourceType,
  ShareVisibility,
} from '../models/share.model';
import FileModel from '../models/file.model';
import FolderModel from '../models/folder.model';
import CollectionModel from '../models/collection.model';
import ActivityModel from '../models/activity.model';
import { dispatchWebhook } from './webhook.service';
import { hashValue, compareValue } from '../utils/bcrypt';
import { Env } from '../config/env.config';
import { toPublicFile } from './files.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';

const assertUser = (userId: string | undefined) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return userId;
};

const generateToken = () => crypto.randomBytes(18).toString('base64url');

/** Strip the password hash before a share object leaves the service layer. */
export const toPublicShare = (share: ShareDocument) => {
  const { passwordHash, ...rest } = share;
  return {
    ...rest,
    url: `${Env.CLIENT_URL}/share/${share.token}`,
  };
};

const resourceExistsForUser = async (
  userId: string,
  resourceType: ShareResourceType,
  resourceId: string,
) => {
  if (resourceType === 'file') {
    const file = await FileModel.findById(resourceId);
    return !!file && file.userId === userId;
  }
  if (resourceType === 'folder') {
    const folder = await FolderModel.findByIdForUser(resourceId, userId);
    return !!folder;
  }
  const collection = await CollectionModel.findByIdForUser(resourceId, userId);
  return !!collection;
};

export interface CreateShareInput {
  resourceType: ShareResourceType;
  resourceId: string;
  visibility?: ShareVisibility;
  permission?: SharePermission;
  password?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
}

export const createShareService = async (
  userId: string | undefined,
  input: CreateShareInput,
) => {
  const uid = assertUser(userId);
  const owns = await resourceExistsForUser(uid, input.resourceType, input.resourceId);
  if (!owns) throw new NotFoundException('Resource not found');

  const passwordHash = input.password ? await hashValue(input.password) : null;
  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime()))
    throw new BadRequestException('Invalid expiry date');

  const share = await ShareModel.create({
    userId: uid,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    token: generateToken(),
    visibility: input.visibility ?? 'PUBLIC',
    permission: input.permission ?? 'view',
    passwordHash,
    expiresAt,
    maxDownloads: input.maxDownloads ?? null,
  });

  await ActivityModel.record({
    userId: uid,
    action: 'share.create',
    entityType: input.resourceType,
    entityId: input.resourceId,
    metadata: { shareId: share._id, permission: share.permission },
  }).catch(() => undefined);

  dispatchWebhook(uid, 'share.created', {
    shareId: share._id,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    permission: share.permission,
  });
  await ActivityModel.recordShareAudit({
    shareId: share._id,
    action: 'created',
    metadata: { permission: share.permission },
  }).catch(() => undefined);

  return toPublicShare(share);
};

export const listSharesService = async (userId: string | undefined) => {
  const uid = assertUser(userId);
  const shares = await ShareModel.findAllForUser(uid);
  return shares.map(toPublicShare);
};

export const listSharesForResourceService = async (
  userId: string | undefined,
  resourceType: ShareResourceType,
  resourceId: string,
) => {
  const uid = assertUser(userId);
  const shares = await ShareModel.findForResource(uid, resourceType, resourceId);
  return shares.map(toPublicShare);
};

export interface UpdateShareInput {
  visibility?: ShareVisibility;
  permission?: SharePermission;
  password?: string | null;
  expiresAt?: string | null;
  maxDownloads?: number | null;
  isActive?: boolean;
}

export const updateShareService = async (
  userId: string | undefined,
  shareId: string,
  input: UpdateShareInput,
) => {
  const uid = assertUser(userId);
  const found = await ShareModel.findByIdForUser(shareId, uid);
  if (!found) throw new NotFoundException('Share not found');

  const passwordHash =
    input.password === undefined
      ? undefined
      : input.password
        ? await hashValue(input.password)
        : null;
  const expiresAt =
    input.expiresAt === undefined
      ? undefined
      : input.expiresAt
        ? new Date(input.expiresAt)
        : null;

  const updated = await ShareModel.update(shareId, uid, {
    visibility: input.visibility,
    permission: input.permission,
    passwordHash,
    expiresAt,
    maxDownloads: input.maxDownloads,
    isActive: input.isActive,
  });
  if (!updated) throw new NotFoundException('Share not found');
  return toPublicShare(updated);
};

export const revokeShareService = async (
  userId: string | undefined,
  shareId: string,
) => {
  const uid = assertUser(userId);
  const found = await ShareModel.findByIdForUser(shareId, uid);
  if (!found) throw new NotFoundException('Share not found');
  await ShareModel.deleteByIdForUser(shareId, uid);
  await ActivityModel.record({
    userId: uid,
    action: 'share.revoke',
    entityType: found.resourceType,
    entityId: found.resourceId,
    metadata: { shareId },
  }).catch(() => undefined);
  return { revoked: true };
};

export const getShareAuditService = async (
  userId: string | undefined,
  shareId: string,
) => {
  const uid = assertUser(userId);
  const found = await ShareModel.findByIdForUser(shareId, uid);
  if (!found) throw new NotFoundException('Share not found');
  return ActivityModel.listShareAudit(shareId);
};

// ---- Public (anonymous) access by token ----------------------------------

export interface ShareAccessContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const isExpired = (share: ShareDocument) =>
  !!share.expiresAt && new Date(share.expiresAt).getTime() < Date.now();

const isDownloadLimitReached = (share: ShareDocument) =>
  share.maxDownloads !== null && share.downloadCount >= share.maxDownloads;

const auditDeny = (shareId: string, action: string, ctx: ShareAccessContext, reason: string) =>
  ActivityModel.recordShareAudit({
    shareId,
    action,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { reason },
  }).catch(() => undefined);

/**
 * Resolve a share for an anonymous viewer. Enforces active/expiry/password, records
 * the view, and returns the underlying resource payload (only files are streamed here;
 * folders/collections resolve to their file listing).
 */
export const resolveShareService = async (
  token: string,
  password: string | undefined,
  ctx: ShareAccessContext,
) => {
  const share = await ShareModel.findByToken(token);
  if (!share) throw new NotFoundException('Share not found');

  if (!share.isActive) {
    await auditDeny(share._id, 'access_denied', ctx, 'inactive');
    throw new ForbiddenException('This share link is no longer active');
  }
  if (isExpired(share)) {
    await auditDeny(share._id, 'access_denied', ctx, 'expired');
    throw new ForbiddenException('This share link has expired');
  }
  if (share.hasPassword) {
    const ok = password ? await compareValue(password, share.passwordHash || '') : false;
    if (!ok) {
      await auditDeny(share._id, 'access_denied', ctx, password ? 'bad_password' : 'password_required');
      throw new ForbiddenException(password ? 'Incorrect password' : 'Password required');
    }
  }

  const refreshed = await ShareModel.incrementViewCount(share._id);
  await ActivityModel.recordShareAudit({
    shareId: share._id,
    action: 'viewed',
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { permission: share.permission },
  }).catch(() => undefined);

  const payload = await loadShareResource(share);
  return {
    share: toPublicShare(refreshed || share),
    ...payload,
  };
};

const loadShareResource = async (share: ShareDocument) => {
  if (share.resourceType === 'file') {
    const file = await FileModel.findById(share.resourceId);
    return { resourceType: 'file', files: file ? [toPublicFile(file)] : [] };
  }
  if (share.resourceType === 'collection') {
    const ids = await CollectionModel.findItemIds(share.resourceId);
    const files = await FileModel.findByIdsForUser(ids, share.userId);
    return { resourceType: 'collection', files: files.map(toPublicFile) };
  }
  // folder
  const files = await FileModel.findAllByUser(share.userId, undefined, {
    limit: 1000,
    offset: 0,
  }, share.resourceId);
  return { resourceType: 'folder', files: files.map(toPublicFile) };
};

/**
 * Consume a download slot for a share (enforces the download limit and permission).
 * Returns the resolved file id to download, or throws when not permitted.
 */
export const consumeShareDownloadService = async (
  token: string,
  password: string | undefined,
  fileId: string,
  ctx: ShareAccessContext,
) => {
  const share = await ShareModel.findByToken(token);
  if (!share || !share.isActive || isExpired(share)) {
    if (share) await auditDeny(share._id, 'download_denied', ctx, 'inactive_or_expired');
    throw new ForbiddenException('This share link is not usable');
  }
  if (share.permission === 'view') {
    await auditDeny(share._id, 'download_denied', ctx, 'permission');
    throw new ForbiddenException('Downloads are not permitted for this share');
  }
  if (share.hasPassword) {
    const ok = password ? await compareValue(password, share.passwordHash || '') : false;
    if (!ok) {
      await auditDeny(share._id, 'download_denied', ctx, 'password');
      throw new ForbiddenException('Password required or incorrect');
    }
  }

  const slot = await ShareModel.consumeDownloadSlot(share._id);
  if (!slot) {
    await auditDeny(share._id, 'download_denied', ctx, 'download_limit');
    throw new ForbiddenException('Download limit reached');
  }

  // Ensure the requested file belongs to this share's resource.
  const owns = await shareContainsFile(share, fileId);
  if (!owns) {
    await auditDeny(share._id, 'download_denied', ctx, 'file_not_in_share');
    throw new ForbiddenException('File is not part of this share');
  }

  await ActivityModel.recordShareAudit({
    shareId: share._id,
    action: 'downloaded',
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { fileId },
  }).catch(() => undefined);

  const file = await FileModel.findById(fileId);
  return { fileId, shareId: share._id, filename: file?.originalName || 'download' };
};

const shareContainsFile = async (share: ShareDocument, fileId: string) => {
  if (share.resourceType === 'file') return share.resourceId === fileId;
  if (share.resourceType === 'collection') {
    const ids = await CollectionModel.findItemIds(share.resourceId);
    return ids.includes(fileId);
  }
  const file = await FileModel.findById(fileId);
  return !!file && file.folderId === share.resourceId && file.userId === share.userId;
};
