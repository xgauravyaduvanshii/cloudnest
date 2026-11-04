import crypto from 'crypto';
import WebhookModel from '../models/webhook.model';
import { logger } from '../utils/logger';
import { BadRequestException, NotFoundException, UnauthorizedException } from '../utils/app-error';
import { isValidWebhookEvent } from '../constant/scopes';

const DELIVERY_TIMEOUT_MS = 5000;

/** Signs a payload the way receiving servers verify it: HMAC over `${ts}.${body}`. */
export const signWebhookPayload = (secret: string, timestamp: number, body: string) =>
  crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');

/**
 * Best-effort, non-blocking fan-out of a domain event to the user's active webhook
 * endpoints subscribed to that event. Delivery failures are logged and recorded but
 * never propagate to the caller (a webhook outage must not fail a user's upload).
 */
export const dispatchWebhook = (userId: string | undefined, event: string, data: Record<string, unknown>) => {
  if (!userId) return;
  // Fire-and-forget. Errors are swallowed inside so callers never await this.
  void deliverToEndpoints(userId, event, data).catch((err) =>
    logger.error('Webhook dispatch failed', { event, error: (err as Error).message }),
  );
};

const deliverToEndpoints = async (userId: string, event: string, data: Record<string, unknown>) => {
  const endpoints = await WebhookModel.findActiveWithSecretsForEvent(userId, event);
  if (!endpoints.length) return;

  const payload = { id: crypto.randomUUID(), event, createdAt: new Date().toISOString(), data };
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    endpoints.map(async (endpoint) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = signWebhookPayload(endpoint.secret, timestamp, body);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CloudNest-Event': event,
            'X-CloudNest-Timestamp': String(timestamp),
            'X-CloudNest-Signature': `t=${timestamp},v1=${signature}`,
          },
          body,
          signal: controller.signal,
        });
        await WebhookModel.recordDelivery({
          endpointId: endpoint._id,
          event,
          payload,
          status: response.ok ? 'delivered' : 'failed',
          responseStatus: response.status,
        });
      } catch (err) {
        await WebhookModel.recordDelivery({
          endpointId: endpoint._id,
          event,
          payload,
          status: 'failed',
          error: (err as Error).message,
        });
      } finally {
        clearTimeout(timer);
      }
    }),
  );
};

// ---- CRUD (user-scoped) ----------------------------------------------------

export const createWebhookService = async (
  userId: string | undefined,
  input: { url: string; events: string[] },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  if (!isHttpUrl(input.url)) throw new BadRequestException('Webhook url must be a valid http(s) URL');
  const invalid = input.events.filter((e) => !isValidWebhookEvent(e));
  if (invalid.length) throw new BadRequestException(`Unknown events: ${invalid.join(', ')}`);
  if (!input.events.length) throw new BadRequestException('At least one event is required');

  const secret = WebhookModel.generateSecret();
  const endpoint = await WebhookModel.create({
    userId,
    url: input.url,
    secret,
    events: input.events,
  });

  // The secret is revealed exactly once, at creation.
  return { endpoint, secret };
};

export const listWebhooksService = async (userId: string | undefined) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return WebhookModel.listForUser(userId);
};

export const updateWebhookService = async (
  userId: string | undefined,
  id: string,
  data: { url?: string; events?: string[]; isActive?: boolean },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  if (data.events) {
    const invalid = data.events.filter((e) => !isValidWebhookEvent(e));
    if (invalid.length) throw new BadRequestException(`Unknown events: ${invalid.join(', ')}`);
  }
  if (data.url && !isHttpUrl(data.url)) throw new BadRequestException('Webhook url must be a valid http(s) URL');
  const updated = await WebhookModel.update(userId, id, data);
  if (!updated) throw new NotFoundException('Webhook endpoint not found');
  return updated;
};

export const deleteWebhookService = async (userId: string | undefined, id: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const deleted = await WebhookModel.deleteForUser(userId, id);
  if (!deleted) throw new NotFoundException('Webhook endpoint not found');
  return { deleted: true };
};

export const listDeliveriesService = async (userId: string | undefined, id: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const endpoint = await WebhookModel.findByIdForUser(userId, id);
  if (!endpoint) throw new NotFoundException('Webhook endpoint not found');
  return WebhookModel.listDeliveriesForEndpoint(userId, id);
};

const isHttpUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
