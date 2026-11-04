import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import {
  createWebhookService,
  deleteWebhookService,
  listDeliveriesService,
  listWebhooksService,
  updateWebhookService,
} from '../services/webhook.service';
import {
  createWebhookSchema,
  updateWebhookSchema,
  webhookIdSchema,
} from '../validators/webhook.validator';
import { WEBHOOK_EVENTS } from '../constant/scopes';

export const listWebhookEventsController = asyncHandler(async (_req: Request, res: Response) => {
  return res.status(HTTPSTATUS.OK).json({ events: WEBHOOK_EVENTS });
});

export const listWebhooksController = asyncHandler(async (req: Request, res: Response) => {
  const webhooks = await listWebhooksService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json({ webhooks });
});

export const createWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const payload = createWebhookSchema.parse(req.body);
  const result = await createWebhookService(req.user?._id, payload);
  return res.status(HTTPSTATUS.CREATED).json({
    ...result,
    message: 'Webhook created. Store the secret now — it will not be shown again.',
  });
});

export const updateWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const id = webhookIdSchema.parse(req.params.id);
  const payload = updateWebhookSchema.parse(req.body);
  const webhook = await updateWebhookService(req.user?._id, id, payload);
  return res.status(HTTPSTATUS.OK).json({ webhook, message: 'Webhook updated' });
});

export const deleteWebhookController = asyncHandler(async (req: Request, res: Response) => {
  const id = webhookIdSchema.parse(req.params.id);
  await deleteWebhookService(req.user?._id, id);
  return res.status(HTTPSTATUS.OK).json({ message: 'Webhook deleted' });
});

export const listDeliveriesController = asyncHandler(async (req: Request, res: Response) => {
  const id = webhookIdSchema.parse(req.params.id);
  const deliveries = await listDeliveriesService(req.user?._id, id);
  return res.status(HTTPSTATUS.OK).json({ deliveries });
});
