import { z } from 'zod';

export const contactStatusEnum = [
  'NEW',
  'APPROVED',
  'IN_PROGRESS',
  'SOLVED',
  'REJECTED',
] as const;

export const submitContactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address').max(254),
  subject: z.string().trim().max(150).optional().or(z.literal('')),
  message: z
    .string()
    .trim()
    .min(10, 'Please describe your request in a little more detail')
    .max(5000),
});

export const contactStatusSchema = z.enum(contactStatusEnum);

export const updateContactStatusSchema = z.object({
  status: contactStatusSchema,
  adminNote: z.string().trim().max(2000).nullish(),
});

export const contactIdSchema = z.string().uuid('Invalid request ID');

export type SubmitContactSchemaType = z.infer<typeof submitContactSchema>;
export type UpdateContactStatusSchemaType = z.infer<
  typeof updateContactStatusSchema
>;
