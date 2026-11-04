import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { UnauthorizedException } from '../utils/app-error';
import { KEY_TYPE, KeyType } from '../utils/key';
import ApiKeyModel from '../models/apiKeys.model';
import { logger } from '../utils/logger';
import { findByIdUserService } from '../services/user.service';

export const apiKeyAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'API key required. Use Authoriation Bearer <API_KEY>',
      );
    }

    const apiKey = authHeader.slice(7).trim();
    if (!apiKey) throw new UnauthorizedException('API key missing');

    if (!apiKey.startsWith('sk_') || apiKey.length < 20) {
      logger.error('Invalid Api key format');
      throw new UnauthorizedException('Invalid Api key format');
    }

    const parts = apiKey.split('_');
    if (parts.length < 3 || parts[0] !== 'sk') {
      throw new UnauthorizedException('Invalid Api key format');
    }

    const keyType = parts[1]; // 'live'

    if (!Object.values(KEY_TYPE).includes(keyType as KeyType)) {
      throw new UnauthorizedException('Invalid Api key type');
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const apiKeyDoc = await ApiKeyModel.findByHashedKey(hashedKey);

    if (!apiKeyDoc) {
      logger.warn('API Key not found');
      throw new UnauthorizedException('Invalid API key');
    }

    if (apiKeyDoc.isRevoked) {
      logger.warn('Revoked API key used', apiKeyDoc.displayKey);
      throw new UnauthorizedException('API key has been revoked');
    }

    if (apiKeyDoc.expiresAt && new Date(apiKeyDoc.expiresAt).getTime() < Date.now()) {
      logger.warn('Expired API key used', apiKeyDoc.displayKey);
      throw new UnauthorizedException('API key has expired');
    }

    const user = await findByIdUserService(apiKeyDoc.userId);

    if (!user) {
      throw new UnauthorizedException('User not found for this API key');
    }

    ApiKeyModel.updateLastUsedAt(hashedKey).catch((error) =>
      logger.error('Failed to update API key last used time', error),
    );

    // Fire-and-forget usage audit; must never block or fail the request.
    ApiKeyModel.logUsage({
      apiKeyId: apiKeyDoc._id,
      userId: apiKeyDoc.userId,
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip ?? null,
    }).catch((error) => logger.error('Failed to log API key usage', error));

    req.user = user;
    req.apiKey = {
      id: apiKeyDoc._id,
      displayKey: apiKeyDoc.displayKey,
      scopes: apiKeyDoc.scopes ?? [],
    };

    logger.info('API KEY Used', apiKeyDoc.displayKey);

    next();
  } catch (error) {
    next(error);
  }
};
