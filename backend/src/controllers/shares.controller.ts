import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  consumeShareDownloadService,
  createShareService,
  getShareAuditService,
  listSharesForResourceService,
  listSharesService,
  resolveShareService,
  revokeShareService,
  updateShareService,
} from '../services/shares.service';
import { getFileUrlService } from '../services/files.service';
import {
  createShareSchema,
  resolveShareSchema,
  shareIdSchema,
  shareResourceTypeSchema,
  shareTokenSchema,
  updateShareSchema,
} from '../validators/shares.validator';
import { fileIdSchema } from '../validators/files.validator';
import { BadRequestException } from '../utils/app-error';

const accessContext = (req: Request) => ({
  ipAddress: req.ip || (req.headers['x-forwarded-for'] as string) || null,
  userAgent: req.headers['user-agent'] || null,
});

// ---- Authenticated management ----------------------------------------------

export const listSharesController = asyncHandler(async (req: Request, res: Response) => {
  const shares = await listSharesService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json({ shares });
});

export const listSharesForResourceController = asyncHandler(async (req: Request, res: Response) => {
  const resourceType = shareResourceTypeSchema.parse(req.params.resourceType);
  const resourceId = fileIdSchema.parse(req.params.resourceId);
  const shares = await listSharesForResourceService(req.user?._id, resourceType, resourceId);
  return res.status(HTTPSTATUS.OK).json({ shares });
});

export const createShareController = asyncHandler(async (req: Request, res: Response) => {
  const payload = createShareSchema.parse(req.body);
  const share = await createShareService(req.user?._id, payload);
  return res.status(HTTPSTATUS.CREATED).json({ share, message: 'Share link created' });
});

export const updateShareController = asyncHandler(async (req: Request, res: Response) => {
  const shareId = shareIdSchema.parse(req.params.shareId);
  const payload = updateShareSchema.parse(req.body);
  const share = await updateShareService(req.user?._id, shareId, payload);
  return res.status(HTTPSTATUS.OK).json({ share, message: 'Share updated' });
});

export const revokeShareController = asyncHandler(async (req: Request, res: Response) => {
  const shareId = shareIdSchema.parse(req.params.shareId);
  await revokeShareService(req.user?._id, shareId);
  return res.status(HTTPSTATUS.OK).json({ message: 'Share revoked' });
});

export const getShareAuditController = asyncHandler(async (req: Request, res: Response) => {
  const shareId = shareIdSchema.parse(req.params.shareId);
  const audit = await getShareAuditService(req.user?._id, shareId);
  return res.status(HTTPSTATUS.OK).json({ audit });
});

// ---- Public (anonymous) ------------------------------------------------------

export const publicResolveShareController = asyncHandler(async (req: Request, res: Response) => {
  const token = shareTokenSchema.parse(req.params.token);
  const { password } = resolveShareSchema.parse({
    password: typeof req.query.password === 'string' ? req.query.password : undefined,
  });
  const result = await resolveShareService(token, password, accessContext(req));
  return res.status(HTTPSTATUS.OK).json(result);
});

export const publicDownloadShareFileController = asyncHandler(
  async (req: Request, res: Response) => {
    const token = shareTokenSchema.parse(req.params.token);
    const fileId = fileIdSchema.parse(req.params.fileId);
    const password = typeof req.query.password === 'string' ? req.query.password : undefined;
    if (!password) throw new BadRequestException('Password query parameter is required');

    const { filename } = await consumeShareDownloadService(token, password, fileId, accessContext(req));
    const { stream, contentType, fileSize } = await getFileUrlService(fileId);

    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=0, no-store',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'X-Content-Type-Options': 'nosniff',
    });
    if (fileSize) res.set('Content-Length', String(fileSize));
    stream.pipe(res);
  },
);
