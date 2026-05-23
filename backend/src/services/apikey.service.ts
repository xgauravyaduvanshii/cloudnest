import ApiKeyModel from '../models/apiKeys.model';
import { NotFoundException, UnauthorizedException } from '../utils/app-error';
import { generateAPIKey } from '../utils/key';

export const createApiKeyService = async (
  userId: string | undefined,
  name: string,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { rawKey, hashedKey, displayKey } = generateAPIKey();

  await ApiKeyModel.create({
    userId,
    name,
    hashedKey,
    displayKey,
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
