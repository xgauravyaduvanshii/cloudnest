import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  createNoticeService,
  deleteNoticeService,
  dismissNoticeService,
  listActiveNoticesService,
  listAllNoticesService,
  listPublicNoticesService,
  undismissNoticeService,
  updateNoticeService,
} from '../services/notices.service';
import {
  createNoticeSchema,
  noticeIdSchema,
  updateNoticeSchema,
} from '../validators/notices.validator';

export const activeNoticesController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listActiveNoticesService(
      req.user!._id,
      (req.user as any)?.role || 'USER',
    );
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', ...result });
  },
);

export const publicNoticesController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await listPublicNoticesService();
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', ...result });
  },
);

export const dismissNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = noticeIdSchema.parse(req.params.id);
    const result = await dismissNoticeService(req.user!._id, id);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);

export const undismissNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = noticeIdSchema.parse(req.params.id);
    const result = await undismissNoticeService(req.user!._id, id);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);

export const adminListNoticesController = asyncHandler(
  async (_req: Request, res: Response) => {
    const result = await listAllNoticesService();
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', ...result });
  },
);

export const adminCreateNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const data = createNoticeSchema.parse(req.body);
    const result = await createNoticeService(req.user!._id, data);
    return res.status(HTTPSTATUS.CREATED).json(result);
  },
);

export const adminUpdateNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = noticeIdSchema.parse(req.params.id);
    const data = updateNoticeSchema.parse(req.body);
    const result = await updateNoticeService(req.user!._id, id, data);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);

export const adminDeleteNoticeController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = noticeIdSchema.parse(req.params.id);
    const result = await deleteNoticeService(req.user!._id, id);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);
