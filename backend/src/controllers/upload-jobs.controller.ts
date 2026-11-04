import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import { UnauthorizedException } from '../utils/app-error';
import { UploadSourceEnum } from '../models/file.model';
import {
  cancelUploadJobService,
  createUploadJobService,
  getUploadJobProgressService,
  getUploadJobService,
  listUploadJobsService,
  pauseUploadJobService,
  retryUploadJobService,
  resumeUploadJobService,
} from '../services/upload-jobs.service';
import {
  clientRequestIdSchema,
  conflictPolicySchema,
  folderIdSchema,
  googleDriveAccountIdSchema,
  jobIdSchema,
  providerFolderIdSchema,
  providerSchema,
  uploadJobModeSchema,
} from '../validators/files.validator';

const requireUserId = (req: Request): string => {
  const userId = req.user?._id;
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return userId;
};

const asText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;

const parsePagination = (req: Request) => {
  const pageSize = Math.min(
    100,
    Math.max(1, Number(asText(req.query.pageSize) ?? '20') || 20),
  );
  const pageNumber = Math.max(1, Number(asText(req.query.pageNumber) ?? '1') || 1);
  return { pageSize, pageNumber };
};

const makeCreateUploadJobController =
  (uploadedVia: keyof typeof UploadSourceEnum) =>
  asyncHandler(async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const files = (req.files as Express.Multer.File[]) || [];

    const folderId = asText(req.body.folderId)
      ? folderIdSchema.parse(req.body.folderId)
      : null;
    const provider = asText(req.body.provider)
      ? providerSchema.parse(req.body.provider)
      : 'S3';
    const storageAccountId = asText(req.body.storageAccountId)
      ? googleDriveAccountIdSchema.parse(req.body.storageAccountId)
      : null;
    const providerFolderId = asText(req.body.providerFolderId)
      ? providerFolderIdSchema.parse(req.body.providerFolderId)
      : null;
    const mode = asText(req.body.mode)
      ? uploadJobModeSchema.parse(req.body.mode)
      : 'FLAT';
    const conflictPolicy = asText(req.body.conflictPolicy)
      ? conflictPolicySchema.parse(req.body.conflictPolicy)
      : 'SKIP';
    const clientRequestId = asText(req.body.clientRequestId)
      ? clientRequestIdSchema.parse(req.body.clientRequestId)
      : null;
    const relativePaths = req.body.relativePaths as string | string[] | undefined;

    const job = await createUploadJobService(userId, files, uploadedVia, {
      folderId,
      provider,
      storageAccountId,
      providerFolderId,
      mode,
      conflictPolicy,
      relativePaths,
      clientRequestId,
    });

    return res.status(HTTPSTATUS.ACCEPTED).json({
      message: 'Upload job created',
      data: job,
    });
  });

export const createUploadJobController = makeCreateUploadJobController(
  UploadSourceEnum.WEB,
);

export const createUploadJobApiController = makeCreateUploadJobController(
  UploadSourceEnum.API,
);

export const listUploadJobsController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const result = await listUploadJobsService(userId, parsePagination(req));
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', data: result });
  },
);

export const getUploadJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const job = await getUploadJobService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', data: job });
  },
);

export const getUploadJobProgressController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const progress = await getUploadJobProgressService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', data: progress });
  },
);

export const pauseUploadJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const job = await pauseUploadJobService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'Paused', data: job });
  },
);

export const resumeUploadJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const job = await resumeUploadJobService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'Resumed', data: job });
  },
);

export const cancelUploadJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const job = await cancelUploadJobService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'Cancelled', data: job });
  },
);

export const retryUploadJobController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = requireUserId(req);
    const jobId = jobIdSchema.parse(req.params.jobId);
    const job = await retryUploadJobService(userId, jobId);
    return res.status(HTTPSTATUS.OK).json({ message: 'Retrying', data: job });
  },
);
