import ApiKeyModel from '../models/apiKeys.model';
import { NotFoundException, UnauthorizedException } from '../utils/app-error';
import { generateAPIKey } from '../utils/key';
import { DEFAULT_SCOPES } from '../constant/scopes';

export type CreateApiKeyInput = {
  name: string;
  scopes?: string[];
  expiresInDays?: number | null;
};

const computeExpiresAt = (expiresInDays?: number | null) => {
  if (!expiresInDays) return null;
  return new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
};

export const createApiKeyService = async (
  userId: string | undefined,
  input: CreateApiKeyInput,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { rawKey, hashedKey, displayKey } = generateAPIKey();

  await ApiKeyModel.create({
    userId,
    name: input.name,
    hashedKey,
    displayKey,
    scopes: input.scopes?.length ? input.scopes : DEFAULT_SCOPES,
    expiresAt: computeExpiresAt(input.expiresInDays),
  });

  return {
    rawKey,
  };
};

export const getAllApiKeysService = async (
  userId: string | undefined,
  pagination: {
    pageSize: number;
    pageNumber: number;
  },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [apiKeys, totalCount] = await Promise.all([
    ApiKeyModel.findAllByUser(userId, {
      limit: pageSize,
      offset: skip,
    }),
    ApiKeyModel.countByUser(userId),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    apiKeys,
    pagination: {
      pageSize,
      totalCount,
      totalPages,
      pageNumber,
      skip,
    },
  };
};

export const deleteApiKeyService = async (
  userId: string | undefined,
  apiKeyId: string,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const deletedCount = await ApiKeyModel.deleteByIdForUser(userId, apiKeyId);

  if (deletedCount === 0) {
    throw new NotFoundException('API Key not found');
  }

  return {
    deletedCount,
  };
};

/** Soft revoke: key stops working immediately but history/usage logs are kept. */
export const revokeApiKeyService = async (userId: string | undefined, apiKeyId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const revoked = await ApiKeyModel.revokeByIdForUser(userId, apiKeyId);
  if (!revoked) throw new NotFoundException('API Key not found or already revoked');
  return { revoked: true };
};

/** Rotate: revoke the old key and issue a new one with the same scopes/expiry. */
export const rotateApiKeyService = async (userId: string | undefined, apiKeyId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const existing = await ApiKeyModel.findByIdForUser(userId, apiKeyId);
  if (!existing) throw new NotFoundException('API Key not found');

  await ApiKeyModel.revokeByIdForUser(userId, apiKeyId);
  const { rawKey, hashedKey, displayKey } = generateAPIKey();
  await ApiKeyModel.create({
    userId,
    name: existing.name,
    displayKey,
    hashedKey,
    scopes: existing.scopes.length ? existing.scopes : DEFAULT_SCOPES,
    expiresAt: existing.expiresAt,
  });

  return { rawKey };
};
