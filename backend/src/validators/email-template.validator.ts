import { z } from 'zod';

export const emailTemplateIdSchema = z.string().uuid('Invalid template ID');

export const templateAudienceSchema = z.enum(['ALL', 'USER', 'ADMIN']);

export const createEmailTemplateSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, 'Key may only contain lowercase letters, numbers, and underscores'),
  name: z.string().trim().min(1, 'Name is required').max(120),
  subject: z.string().trim().min(1, 'Subject is required').max(255),
  htmlBody: z.string().min(1, 'HTML body is required'),
  textBody: z.string().min(1, 'Plain-text body is required'),
  description: z.string().trim().max(500).nullable().optional(),
  variables: z.array(z.string().trim().min(1)).optional(),
  isEnabled: z.boolean().optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export const emailTemplateEnabledSchema = z.object({
  isEnabled: z.boolean(),
});

export const sendTemplateTestSchema = z.object({
  to: z.string().trim().email('Enter a valid recipient address'),
  configId: z.string().uuid().optional(),
  vars: z.record(z.union([z.string(), z.number()])).optional(),
});

export const broadcastEmailSchema = z.object({
  templateKey: z.string().trim().min(1),
  audience: templateAudienceSchema.default('ALL'),
  vars: z.record(z.union([z.string(), z.number()])).optional(),
});

export type CreateEmailTemplateSchemaType = z.infer<
  typeof createEmailTemplateSchema
>;
export type UpdateEmailTemplateSchemaType = z.infer<
  typeof updateEmailTemplateSchema
>;
export type SendTemplateTestSchemaType = z.infer<typeof sendTemplateTestSchema>;
export type BroadcastEmailSchemaType = z.infer<typeof broadcastEmailSchema>;
