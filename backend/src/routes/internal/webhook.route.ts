import { Router } from 'express';
import {
  createWebhookController,
  deleteWebhookController,
  listDeliveriesController,
  listWebhookEventsController,
  listWebhooksController,
  updateWebhookController,
} from '../../controllers/webhook.controller';

const webhookRoutes = Router();

webhookRoutes.get('/events', listWebhookEventsController);
webhookRoutes.get('/', listWebhooksController);
webhookRoutes.post('/', createWebhookController);
webhookRoutes.patch('/:id', updateWebhookController);
webhookRoutes.delete('/:id', deleteWebhookController);
webhookRoutes.get('/:id/deliveries', listDeliveriesController);

export default webhookRoutes;
