import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  createContactService,
  deleteContactRequestService,
  getMyContactRequestsService,
  listContactRequestsService,
  updateContactStatusService,
} from '../services/contact.service';
import {
  contactIdSchema,
  contactStatusSchema,
  submitContactSchema,
  updateContactStatusSchema,
} from '../validators/contact.validator';

/** Public endpoint. Attaches the user when a valid bearer token is present. */
export const submitContactController = asyncHandler(
  async (req: Request, res: Response) => {
    const payload = submitContactSchema.parse(req.body);
    const result = await createContactService(payload, {
      userId: req.user?._id ?? null,
    });
    return res.status(HTTPSTATUS.CREATED).json(result);
  },
);

export const myContactRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await getMyContactRequestsService(
      req.user?._id,
      req.user?.email,
    );
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', ...result });
  },
);

export const adminListContactRequestsController = asyncHandler(
  async (req: Request, res: Response) => {
    const status = req.query.status
      ? contactStatusSchema.parse(req.query.status)
      : undefined;
    const result = await listContactRequestsService({
      status,
      keyword: req.query.keyword as string | undefined,
      pageSize: parseInt(req.query.pageSize as string) || 20,
      pageNumber: parseInt(req.query.pageNumber as string) || 1,
    });
    return res.status(HTTPSTATUS.OK).json({ message: 'OK', ...result });
  },
);

export const adminUpdateContactStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = contactIdSchema.parse(req.params.id);
    const data = updateContactStatusSchema.parse(req.body);
    const result = await updateContactStatusService(req.user!._id, id, data);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);

export const adminDeleteContactRequestController = asyncHandler(
  async (req: Request, res: Response) => {
    const id = contactIdSchema.parse(req.params.id);
    const result = await deleteContactRequestService(req.user!._id, id);
    return res.status(HTTPSTATUS.OK).json(result);
  },
);
