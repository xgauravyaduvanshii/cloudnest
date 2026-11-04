import { z } from 'zod';

export const collectionIdSchema = z.string().uuid('Invalid collection ID');
const uuidList = z.array(z.string().uuid('Invalid file ID')).min(1);

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(2000).nullish(),
  color: z.string().trim().max(32).nullish(),
  fileIds: uuidList.optional(),
});

export const updateCollectionSchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(2000).nullish(),
    color: z.string().trim().max(32).nullish(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const collectionItemsSchema = z.object({ fileIds: uuidList });

export type CreateCollectionSchemaType = z.infer<typeof createCollectionSchema>;
export type UpdateCollectionSchemaType = z.infer<typeof updateCollectionSchema>;
