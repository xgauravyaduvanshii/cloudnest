import { z } from 'zod';

export const smtpIdSchema = z.string().uuid('Invalid SMTP configuration ID');

export const createSmtpConfigSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  host: z.string().trim().min(1, 'Host is required').max(255),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  username: z.string().trim().max(255).nullable().optional(),
  password: z.string().trim().max(2048).nullable().optional(),
  fromName: z.string().trim().max(120).nullable().optional(),
  fromAddress: z
    .string()
    .trim()
    .email('Enter a valid from address')
    .max(255),
  replyTo: z
    .union([z.string().trim().email().max(255), z.literal(''), z.null()])
    .optional(),
});

export const updateSmtpConfigSchema = createSmtpConfigSchema
  .omit({ password: true })
  .partial()
  .extend({
    // undefined -> keep stored; '' or null -> clear; string -> replace.
    password: z.string().trim().max(2048).nullable().optional(),
  });

export const smtpTestSendSchema = z.object({
  to: z.string().trim().email(),
  templateKey: z.string().trim().min(1),
  configId: z.string().uuid().optional(),
  vars: z.record(z.union([z.string(), z.number()])).optional(),
});

export type CreateSmtpConfigSchemaType = z.infer<typeof createSmtpConfigSchema>;
export type UpdateSmtpConfigSchemaType = z.infer<typeof updateSmtpConfigSchema>;
export type SmtpTestSendSchemaType = z.infer<typeof smtpTestSendSchema>;
