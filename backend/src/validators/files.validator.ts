import { z } from 'zod';

export const fileIdSchema = z.string().uuid('Invalid file ID');
export const folderIdSchema = z.string().uuid('Invalid folder ID');
export const providerSchema = z.enum(['S3', 'GOOGLE_DRIVE', 'TELEGRAM']);

const baseSchema = z.object({
  fileIds: z
    .array(z.string().uuid('Invalid file ID'))
    .min(1, 'At least one file ID must be provided'),
});

export const deleteFilesSchema = baseSchema;
export const downloadFilesSchema = baseSchema;
export const createFolderSchema = z.object({
  name: z.string().trim().min(1).max(255),
  parentId: z.string().uuid('Invalid parent folder ID').nullable().optional(),
  provider: providerSchema.optional(),
});
export const moveFilesSchema = z.object({
  fileIds: z.array(z.string().uuid('Invalid file ID')).min(1),
  targetFolderId: z.string().uuid('Invalid target folder ID').nullable().optional(),
  provider: providerSchema.optional(),
});
export const moveFolderSchema = z.object({
  targetFolderId: z.string().uuid('Invalid target folder ID').nullable().optional(),
  provider: providerSchema.optional(),
});
export const googleDriveAccountIdSchema = z.string().uuid('Invalid storage account ID');
export const googleDriveItemIdSchema = z.string().min(1).max(255);
export const googleDriveFolderSchema = z.object({
  accountId: googleDriveAccountIdSchema,
  name: z.string().trim().min(1).max(255),
  parentId: z.string().min(1).max(255).nullable().optional(),
});
export const googleDriveMoveItemSchema = z.object({
  accountId: googleDriveAccountIdSchema,
  targetFolderId: z.string().min(1).max(255).nullable().optional(),
});

export type DeleteFilesSchemaType = z.infer<typeof deleteFilesSchema>;
export type DownloadFilesSchemaType = z.infer<typeof downloadFilesSchema>;
export type CreateFolderSchemaType = z.infer<typeof createFolderSchema>;
