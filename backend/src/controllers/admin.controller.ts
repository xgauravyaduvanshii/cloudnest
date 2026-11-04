import { Request, Response } from 'express';
import { z } from 'zod';
import { HTTPSTATUS } from '../config/http.config';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import {
  createAdminApiKeyService,
  deleteAdminApiKeyService,
  deleteAdminFilesService,
  disconnectAdminStorageAccountService,
  downloadAdminFilesService,
  getAdminDashboardService,
  listAdminApiKeysService,
  listAdminFilesService,
  listAdminStorageAccountsService,
  listAdminUsersService,
  listProviderSettingsService,
  removeAdminStorageAccountService,
  syncStorageAccountService,
  updateAdminStorageAccountStatusService,
  updateAdminUserService,
  updateProviderSettingService,
} from '../services/admin.service';
import {
  deleteAiModelService,
  fetchProviderModelsService,
  getAiSettingsService,
  listAiModelsService,
  setAiModelEnabledService,
  updateAiSettingsService,
} from '../services/admin-ai.service';

const paginationFromQuery = (req: Request, defaultPageSize = 20) => ({
  pageSize: parseInt(req.query.pageSize as string) || defaultPageSize,
  pageNumber: parseInt(req.query.pageNumber as string) || 1,
});

const providerSchema = z.enum(['S3', 'GOOGLE_DRIVE', 'TELEGRAM']);
const statusSchema = z.enum(['ACTIVE', 'DISABLED', 'ERROR', 'PENDING_AUTH']);

export const adminDashboardController = asyncHandler(
  async (req: Request, res: Response) => {
    const dashboard = await getAdminDashboardService();
    return res.status(HTTPSTATUS.OK).json({
      message: 'Admin dashboard retrieved successfully',
      ...dashboard,
    });
  },
);

export const adminUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminUsersService({
      keyword: req.query.keyword as string | undefined,
      ...paginationFromQuery(req),
    });
    return res.status(HTTPSTATUS.OK).json({
      message: 'Users retrieved successfully',
      ...result,
    });
  },
);

export const adminUpdateUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = z.string().uuid().parse(req.params.id);
    const body = z
      .object({
        role: z.enum(['USER', 'ADMIN']).optional(),
        status: z.enum(['ACTIVE', 'DISABLED']).optional(),
        storageQuota: z.number().int().nonnegative().optional(),
      })
      .parse(req.body);
    const user = await updateAdminUserService(req.user!._id, userId, body);
    return res.status(HTTPSTATUS.OK).json({
      message: 'User updated successfully',
      user,
    });
  },
);

export const adminFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminFilesService({
      keyword: req.query.keyword as string | undefined,
      userId: req.query.userId as string | undefined,
      provider: req.query.provider
        ? providerSchema.parse(req.query.provider)
        : undefined,
      storageAccountId: req.query.storageAccountId as string | undefined,
      ...paginationFromQuery(req),
    });
    return res.status(HTTPSTATUS.OK).json({
      message: 'Files retrieved successfully',
      ...result,
    });
  },
);

export const adminDownloadFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { fileIds } = z
      .object({
        fileIds: z.array(z.string().uuid()).min(1),
      })
      .parse(req.body);
    const result = await downloadAdminFilesService(fileIds);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Admin download URL created successfully',
      downloadUrl: result.url,
      isZip: result.isZip,
    });
  },
);

export const adminDeleteFilesController = asyncHandler(
  async (req: Request, res: Response) => {
    const { fileIds } = z
      .object({
        fileIds: z.array(z.string().uuid()).min(1),
      })
      .parse(req.body);
    const result = await deleteAdminFilesService(req.user!._id, fileIds);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Files deleted successfully',
      ...result,
    });
  },
);

export const adminStorageAccountsController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminStorageAccountsService({
      keyword: req.query.keyword as string | undefined,
      userId: req.query.userId as string | undefined,
      provider: req.query.provider
        ? providerSchema.parse(req.query.provider)
        : undefined,
      status: req.query.status ? statusSchema.parse(req.query.status) : undefined,
      ...paginationFromQuery(req),
    });
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage accounts retrieved successfully',
      ...result,
    });
  },
);

export const adminUpdateStorageAccountStatusController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const { status } = z
      .object({
        status: statusSchema,
      })
      .parse(req.body);
    const account = await updateAdminStorageAccountStatusService(
      req.user!._id,
      accountId,
      status,
    );
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account updated successfully',
      account,
    });
  },
);

export const adminSyncStorageAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const account = await syncStorageAccountService(accountId, req.user!);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account synced successfully',
      account,
    });
  },
);

export const adminDisconnectStorageAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const result = await disconnectAdminStorageAccountService(
      req.user!,
      accountId,
    );
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account disconnected successfully',
      ...result,
    });
  },
);

export const adminRemoveStorageAccountController = asyncHandler(
  async (req: Request, res: Response) => {
    const accountId = z.string().uuid().parse(req.params.id);
    const result = await removeAdminStorageAccountService(
      req.user!._id,
      accountId,
    );
    return res.status(HTTPSTATUS.OK).json({
      message: 'Storage account removed successfully',
      ...result,
    });
  },
);

export const adminApiKeysController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listAdminApiKeysService(paginationFromQuery(req, 10));
    return res.status(HTTPSTATUS.OK).json({
      message: 'API keys retrieved successfully',
      ...result,
    });
  },
);

export const adminCreateApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = z
      .object({
        userId: z.string().uuid(),
        name: z.string().min(2).max(50),
      })
      .parse(req.body);
    const result = await createAdminApiKeyService(
      req.user!._id,
      body.userId,
      body.name,
    );
    return res.status(HTTPSTATUS.OK).json({
      message: 'API key created successfully',
      key: result.rawKey,
    });
  },
);

export const adminDeleteApiKeyController = asyncHandler(
  async (req: Request, res: Response) => {
    const apiKeyId = z.string().uuid().parse(req.params.id);
    const result = await deleteAdminApiKeyService(req.user!._id, apiKeyId);
    return res.status(HTTPSTATUS.OK).json({
      message: 'API key deleted successfully',
      data: result,
    });
  },
);

export const adminProviderSettingsController = asyncHandler(
  async (req: Request, res: Response) => {
    const settings = await listProviderSettingsService();
    return res.status(HTTPSTATUS.OK).json({
      message: 'Provider settings retrieved successfully',
      settings,
    });
  },
);

export const adminUpdateProviderSettingsController = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = providerSchema.parse(req.params.provider);
    const body = z.record(z.unknown()).parse(req.body);
    const setting = await updateProviderSettingService(req.user!, provider, body);
    return res.status(HTTPSTATUS.OK).json({
      message: 'Provider settings updated successfully',
      setting,
    });
  },
);

const aiSettingsSchema = z.object({
  provider: z.string().trim().min(1).max(64).optional(),
  baseUrl: z.string().trim().max(512).nullable().optional(),
  apiKey: z.string().trim().max(512).nullable().optional(),
  isEnabled: z.boolean().optional(),
  defaultChatModel: z.string().trim().max(255).nullable().optional(),
  defaultVisionModel: z.string().trim().max(255).nullable().optional(),
  defaultEmbeddingModel: z.string().trim().max(255).nullable().optional(),
});

export const adminAiSettingsController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await getAiSettingsService();
  return res.status(HTTPSTATUS.OK).json({ message: 'AI settings retrieved', ...result });
});

export const adminUpdateAiSettingsController = asyncHandler(async (req: Request, res: Response) => {
  const body = aiSettingsSchema.parse(req.body);
  const result = await updateAiSettingsService(req.user!._id, body);
  return res.status(HTTPSTATUS.OK).json({ message: 'AI settings updated', ...result });
});

export const adminFetchAiModelsController = asyncHandler(async (req: Request, res: Response) => {
  const result = await fetchProviderModelsService(req.user!._id);
  return res.status(HTTPSTATUS.OK).json({ message: 'Models fetched', ...result });
});

export const adminAiModelsController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await listAiModelsService();
  return res.status(HTTPSTATUS.OK).json({ message: 'Models retrieved', ...result });
});

export const adminSetAiModelEnabledController = asyncHandler(async (req: Request, res: Response) => {
  const id = z.string().uuid().parse(req.params.id);
  const { isEnabled } = z.object({ isEnabled: z.boolean() }).parse(req.body);
  const result = await setAiModelEnabledService(req.user!._id, id, isEnabled);
  return res.status(HTTPSTATUS.OK).json({ message: 'Model updated', ...result });
});

export const adminDeleteAiModelController = asyncHandler(async (req: Request, res: Response) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await deleteAiModelService(req.user!._id, id);
  return res.status(HTTPSTATUS.OK).json({ message: 'Model deleted', ...result });
});
