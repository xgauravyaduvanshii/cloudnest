import { z } from 'zod';

export const shareIdSchema = z.string().uuid('Invalid share ID');
export const shareTokenSchema = z.string().min(8).max(256);
export const shareResourceTypeSchema = z.enum(['file', 'folder', 'collection']);
export const shareVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']);
export const sharePermissionSchema = z.enum(['view', 'download', 'upload', 'edit']);

const expirySchema = z
  .string()
  .datetime({ offset: true, message: 'Invalid ISO-8601 expiry' })
  .or(z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Invalid date'))
  .nullable()
  .optional();

export const createShareSchema = z.object({
  resourceType: shareResourceTypeSchema,
  resourceId: z.string().uuid('Invalid resource ID'),
  visibility: shareVisibilitySchema.optional(),
  permission: sharePermissionSchema.optional(),
  password: z.string().min(4).max(128).nullish(),
  expiresAt: expirySchema,
  maxDownloads: z.number().int().min(0).max(1_000_000).nullish(),
});

export const updateShareSchema = z
  .object({
    visibility: shareVisibilitySchema.optional(),
    permission: sharePermissionSchema.optional(),
    password: z.string().min(4).max(128).nullish(),
    expiresAt: expirySchema,
    maxDownloads: z.number().int().min(0).max(1_000_000).nullish(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });

export const resolveShareSchema = z.object({
  password: z.string().min(1).max(128).optional(),
});

export type CreateShareSchemaType = z.infer<typeof createShareSchema>;
export type UpdateShareSchemaType = z.infer<typeof updateShareSchema>;
