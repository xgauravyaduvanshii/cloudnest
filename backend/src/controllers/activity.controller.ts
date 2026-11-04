import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  getActivityTimelineService,
  getQuotaAlertsService,
  getStorageBreakdownService,
  getTopFilesService,
  getUploadReliabilityService,
} from '../services/activity.service';

const parseIntParam = (value: unknown, fallback: number, min: number, max: number) => {
  const n = typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

const optionalQuery = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

export const activityTimelineController = asyncHandler(async (req: Request, res: Response) => {
  const pageSize = parseIntParam(req.query.pageSize, 20, 1, 100);
  const pageNumber = parseIntParam(req.query.pageNumber, 1, 1, 100000);
  const result = await getActivityTimelineService(
    req.user?._id,
    { pageSize, pageNumber },
    {
      action: optionalQuery(req.query.action),
      entityType: optionalQuery(req.query.entityType),
    },
  );
  return res.status(HTTPSTATUS.OK).json(result);
});

export const storageBreakdownController = asyncHandler(async (req: Request, res: Response) => {
  const breakdown = await getStorageBreakdownService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json(breakdown);
});

export const uploadReliabilityController = asyncHandler(async (req: Request, res: Response) => {
  const reliability = await getUploadReliabilityService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json(reliability);
});

export const topFilesController = asyncHandler(async (req: Request, res: Response) => {
  const limit = parseIntParam(req.query.limit, 10, 1, 50);
  const result = await getTopFilesService(req.user?._id, limit);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const quotaAlertsController = asyncHandler(async (req: Request, res: Response) => {
  const threshold = parseIntParam(req.query.threshold, 90, 1, 100) / 100;
  const alerts = await getQuotaAlertsService(req.user?._id, threshold);
  return res.status(HTTPSTATUS.OK).json({ alerts });
});
