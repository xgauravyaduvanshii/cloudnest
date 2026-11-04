import { z } from 'zod';
import { ALL_SCOPES } from '../constant/scopes';

export const createApiKeySchema = z.object({
  name: z.string().min(2).max(50),
  scopes: z.array(z.enum(ALL_SCOPES as [string, ...[string, ...string[]]])).optional(),
  expiresInDays: z.number().int().min(1).max(3650).nullish(),
});

export const deleteApiKeySchema = z.object({
  id: z.string().uuid('Invalid API key ID'),
});

export type CreateApiKeySchemaType = z.infer<typeof createApiKeySchema>;
