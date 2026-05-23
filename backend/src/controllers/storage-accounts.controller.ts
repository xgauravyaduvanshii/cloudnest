import { Request, Response } from 'express';
import { z } from 'zod';
import { Env } from '../config/env.config';
import { HTTPSTATUS } from '../config/http.config';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import {
  disconnectStorageAccountService,
  getGoogleAuthUrlService,
  handleGoogleCallbackService,
  listEnabledProvidersService,
  listStorageAccountsService,
  startTelegramAuthService,
  syncStorageAccountService,
  verifyTelegramCodeService,
  verifyTelegramPasswordService,
} from '../services/storage-accounts.service';

const ownerTypeSchema = z.enum(['USER', 'ADMIN']).default('USER');

export const getStorageAccountsController = asyncHandler(
  async (req: Request, res: Response) => {
    const accounts = await listStorageAccountsService(req.user!);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage accounts retrieved successfully',
      accounts,
    });
  },
);

export const getEnabledProvidersController = asyncHandler(
  async (_req: Request, res: Response) => {
    const providers = await listEnabledProvidersService();
    return res.status(HTTPSTATUS.OK).json({
      message: 'Enabled providers retrieved successfully',
      providers,
    });
  },
);

export const getGoogleAuthUrlController = asyncHandler(
  async (req: Request, res: Response) => {
    const ownerType = ownerTypeSchema.parse(req.query.ownerType || 'USER');
    const result = await getGoogleAuthUrlService(req.user!, ownerType);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Google authorization URL created successfully',
      ...result,
    });
  },
);

export const googleCallbackController = asyncHandler(
  async (req: Request, res: Response) => {
    const code = z.string().min(1).parse(req.query.code);
    const state = z.string().min(1).parse(req.query.state);
    const account = await handleGoogleCallbackService(code, state);
    const redirectPath =
      account.ownerType === 'ADMIN'
        ? '/admin?connected=google'
        : '/storage-accounts?connected=google';
    return res.redirect(`${Env.CLIENT_URL}${redirectPath}`);
  },
);

export const startTelegramAuthController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = z
      .object({
        phoneNumber: z.string().min(5),
        ownerType: z.enum(['USER', 'ADMIN']).optional(),
      })
      .parse(req.body);
    const result = await startTelegramAuthService(req.user!, body);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Telegram code sent successfully',
      ...result,
    });
  },
);

export const verifyTelegramCodeController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = z
      .object({
        authId: z.string().uuid(),
        code: z.string().min(1),
      })
      .parse(req.body);
    const result = await verifyTelegramCodeService(body.authId, body.code);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Telegram code verified successfully',
      ...result,
    });
  },
);

export const verifyTelegramPasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = z
      .object({
        authId: z.string().uuid(),
        password: z.string().min(1),
      })
      .parse(req.body);
    const result = await verifyTelegramPasswordService(
      body.authId,
      body.password,
    );
    return res.status(HTTPSTATUS.OK).json({
      message: 'Telegram password verified successfully',
      ...result,
    });
  },
);

export const syncStorageAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const account = await syncStorageAccountService(accountId, req.user!);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account synced successfully',
      account,
    });
  },
);

export const disconnectStorageAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const result = await disconnectStorageAccountService(accountId, req.user!);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account disconnected successfully',
      ...result,
    });
  },
);
