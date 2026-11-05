import { z } from 'zod';

export const noticeLevelSchema = z.enum([
  'welcome',
  'info',
  'success',
  'warning',
  'maintenance',
]);
export const noticeAudienceSchema = z.enum(['ALL', 'USER', 'ADMIN']);

const optionalDate = z
  .union([z.string().datetime(), z.string(), z.null()])
  .optional()
  .transform((v) => (v ? new Date(v) : null));

const baseNotice = {
  title: z.string().trim().min(1, 'Title is required').max(140),
  body: z.string().trim().min(1, 'Message is required').max(4000),
  level: noticeLevelSchema.default('info'),
  audience: noticeAudienceSchema.default('ALL'),
  isPublished: z.boolean().default(false),
  isDismissable: z.boolean().default(true),
  priority: z.coerce.number().int().min(0).max(9999).default(0),
  startsAt: optionalDate,
  endsAt: optionalDate,
};

export const createNoticeSchema = z.object(baseNotice);

export const updateNoticeSchema = z.object({
  title: baseNotice.title.optional(),
  body: baseNotice.body.optional(),
  level: noticeLevelSchema.optional(),
  audience: noticeAudienceSchema.optional(),
  isPublished: z.boolean().optional(),
  isDismissable: z.boolean().optional(),
  priority: z.coerce.number().int().min(0).max(9999).optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

export const noticeIdSchema = z.string().uuid('Invalid notice ID');

export type CreateNoticeSchemaType = z.infer<typeof createNoticeSchema>;
export type UpdateNoticeSchemaType = z.infer<typeof updateNoticeSchema>;
