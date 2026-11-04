import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  getVersionHistoryService,
  restoreFileVersionService,
} from '../services/file-versions.service';
import { fileIdSchema } from '../validators/files.validator';

export const getFileVersionsController = asyncHandler(async (req: Request, res: Response) => {
  const fileId = fileIdSchema.parse(req.params.fileId);
  const history = await getVersionHistoryService(req.user?._id, fileId);
  return res.status(HTTPSTATUS.OK).json(history);
});

export const restoreFileVersionController = asyncHandler(async (req: Request, res: Response) => {
  const fileId = fileIdSchema.parse(req.params.fileId);
  const file = await restoreFileVersionService(req.user?._id, fileId);
  return res
    .status(HTTPSTATUS.OK)
    .json({ file, message: 'Version restored as the latest revision' });
});
