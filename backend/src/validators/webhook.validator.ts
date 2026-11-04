import { z } from 'zod';

export const webhookIdSchema = z.string().uuid('Invalid webhook ID');

export const createWebhookSchema = z.object({
  url: z.string().trim().url().max(2000),
  events: z.array(z.string().trim().min(3).max(64)).min(1).max(10),
});

export const updateWebhookSchema = z
  .object({
    url: z.string().trim().url().max(2000).optional(),
    events: z.array(z.string().trim().min(3).max(64)).min(1).max(10).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
