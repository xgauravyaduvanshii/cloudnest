import { z } from 'zod';

export const fileIdSchema = z.string().uuid('Invalid file ID');
const uuidList = z.array(z.string().uuid('Invalid file ID'));

export const enrichSchema = z.object({ fileId: fileIdSchema });

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(512),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const assistantPlanSchema = z.object({
  instruction: z.string().trim().min(3).max(2000),
  model: z.string().trim().min(1).max(255).optional(),
  fileIds: uuidList.optional(),
  folderId: z.string().uuid().optional(),
});

const createCollectionAction = z.object({
  type: z.literal('create_collection'),
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullish(),
});

const addToCollectionAction = z.object({
  type: z.literal('add_to_collection'),
  collection: z.string().trim().min(1).max(255),
  fileIds: uuidList.min(1),
});

export const assistantApplySchema = z.object({
  actions: z.array(z.discriminatedUnion('type', [createCollectionAction, addToCollectionAction])).min(1),
});

export const chatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  conversationId: z.string().uuid().optional(),
  fileIds: uuidList.optional(),
  folderId: z.string().uuid().optional(),
  model: z.string().trim().min(1).max(255).optional(),
});

export const conversationIdSchema = z.string().uuid('Invalid conversation ID');

export type AssistantApplySchemaType = z.infer<typeof assistantApplySchema>;
