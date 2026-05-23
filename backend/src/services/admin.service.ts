import jwt from 'jsonwebtoken';
import { query, withTransaction } from '../config/database.config';
import { Env } from '../config/env.config';
import AdminAuditModel from '../models/admin-audit.model';
import ApiKeyModel from '../models/apiKeys.model';
import FileModel from '../models/file.model';
import StorageModel from '../models/storage.model';
import StorageAccountModel, {
  StorageAccountStatus,
  StorageProviderType,
} from '../models/storage-account.model';
import UserModel, { UserRole, UserStatus } from '../models/user.model';
import { getStorageProvider } from '../providers';
import { generateAPIKey } from '../utils/key';
import { NotFoundException } from '../utils/app-error';
import {
  getPublicFileUrl,
} from './files.service';
import {
  disconnectStorageAccountService,
  listProviderSettingsService,
  serializeStorageAccount,
  syncStorageAccountService,
  updateProviderSettingService,
} from './storage-accounts.service';

export const getAdminDashboardService = async () => {
  const [totals, providerStats] = await Promise.all([
    query<{
      users: number;
      files: number;
      api_keys: number;
      storage_accounts: number;
      total_file_bytes: number;
    }>(
      `SELECT
        (SELECT COUNT(*)::int FROM users) AS users,
        (SELECT COUNT(*)::int FROM files) AS files,
        (SELECT COUNT(*)::int FROM api_keys) AS api_keys,
        (SELECT COUNT(*)::int FROM storage_accounts) AS storage_accounts,
        (SELECT COALESCE(SUM(size), 0)::bigint FROM files) AS total_file_bytes`,
    ),
    StorageAccountModel.providerStats(),
  ]);

  return {
    totals: totals.rows[0],
    providerStats,
  };
};

export const listAdminUsersService = async (options: {
  keyword?: string;
  pageSize: number;
  pageNumber: number;
}) => {
  const skip = (options.pageNumber - 1) * options.pageSize;
  const [users, totalCount] = await Promise.all([
    UserModel.findAll({
      keyword: options.keyword,
      limit: options.pageSize,
      offset: skip,
    }),
    UserModel.countAll(options.keyword),
  ]);

  return {
    users: users.map((user) => user.omitPassword()),
    pagination: {
      pageSize: options.pageSize,
      pageNumber: options.pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / options.pageSize),
      skip,
    },
  };
};

export const updateAdminUserService = async (
  adminUserId: string,
  targetUserId: string,
  data: {
    role?: UserRole;
    status?: UserStatus;
    storageQuota?: number;
  },
) => {
  const updated = await withTransaction(async (client) => {
    const user = await UserModel.updateAdminFields(
      targetUserId,
      {
        role: data.role,
        status: data.status,
      },
      client,
    );
    if (!user) throw new NotFoundException('User not found');

    if (data.storageQuota !== undefined) {
      await StorageModel.updateQuota(targetUserId, data.storageQuota, client);
    }

    return user;
  });

  await AdminAuditModel.create({
    adminUserId,
    targetUserId,
    action: 'USER_UPDATE',
    entityType: 'USER',
    entityId: targetUserId,
    metadata: data,
  });

  return updated.omitPassword();
};

export const listAdminFilesService = async (options: {
  keyword?: string;
  userId?: string;
  provider?: StorageProviderType;
  storageAccountId?: string;
  pageSize: number;
  pageNumber: number;
}) => {
  const skip = (options.pageNumber - 1) * options.pageSize;
  const [files, totalCount] = await Promise.all([
    FileModel.findAllAdmin({
      keyword: options.keyword,
      userId: options.userId,
      provider: options.provider,
      storageAccountId: options.storageAccountId,
      limit: options.pageSize,
      offset: skip,
    }),
    FileModel.countAllAdmin({
      keyword: options.keyword,
      userId: options.userId,
      provider: options.provider,
      storageAccountId: options.storageAccountId,
    }),
  ]);

  return {
    files: files.map((file) => {
      const { storageKey, ...publicFile } = file;
      return {
        ...publicFile,
        url: getPublicFileUrl(file._id),
      };
    }),
    pagination: {
      pageSize: options.pageSize,
      pageNumber: options.pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / options.pageSize),
      skip,
    },
  };
};

export const downloadAdminFilesService = async (fileIds: string[]) => {
  const files = await FileModel.findByIds(fileIds);
  if (!files.length) throw new NotFoundException('No files found');

  if (files.length === 1) {
    return {
      url: getPublicFileUrl(files[0]._id),
      isZip: false,
    };
  }

  const token = jwt.sign(
    {
      fileIds,
      admin: true,
    },
    Env.JWT_SECRET,
    {
      expiresIn: '10m',
      audience: ['file-download'],
    },
  );

  return {
    url: `${Env.API_PUBLIC_URL}${Env.BASE_PATH}/files/download-zip?token=${encodeURIComponent(token)}`,
    isZip: true,
  };
};

export const deleteAdminFilesService = async (
  adminUserId: string,
  fileIds: string[],
) => {
  const files = await FileModel.findByIds(fileIds);
  if (!files.length) throw new NotFoundException('No files found');

  const providerErrors: string[] = [];
  await Promise.all(
    files.map(async (file) => {
      try {
        if (!file.storageAccountId) return;
        const account = await StorageAccountModel.findById(file.storageAccountId);
        if (!account) return;
        const provider = getStorageProvider(account.provider);
        await provider.delete(account, file);
      } catch {
        providerErrors.push(file._id);
      }
    }),
  );

  const successfulFileIds = files
    .filter((file) => !providerErrors.includes(file._id))
    .map((file) => file._id);
  const deletedCount = await withTransaction((client) =>
    FileModel.deleteByIds(successfulFileIds, client),
  );

  await AdminAuditModel.create({
    adminUserId,
    action: 'FILES_DELETE',
    entityType: 'FILE',
    metadata: {
      requestedFileIds: fileIds,
      deletedCount,
      failedCount: providerErrors.length,
    },
  });

  return {
    deletedCount,
    failedCount: providerErrors.length,
  };
};

export const listAdminStorageAccountsService = async (options: {
  keyword?: string;
  userId?: string;
  provider?: StorageProviderType;
  status?: StorageAccountStatus;
  pageSize: number;
  pageNumber: number;
}) => {
  const skip = (options.pageNumber - 1) * options.pageSize;
  const [accounts, totalCount] = await Promise.all([
    StorageAccountModel.findAll({
      keyword: options.keyword,
      userId: options.userId,
      provider: options.provider,
      status: options.status,
      limit: options.pageSize,
      offset: skip,
    }),
    StorageAccountModel.countAll({
      keyword: options.keyword,
      userId: options.userId,
      provider: options.provider,
      status: options.status,
    }),
  ]);

  return {
    accounts: accounts.map(serializeStorageAccount),
    pagination: {
      pageSize: options.pageSize,
      pageNumber: options.pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / options.pageSize),
      skip,
    },
  };
};

export const updateAdminStorageAccountStatusService = async (
  adminUserId: string,
  accountId: string,
  status: StorageAccountStatus,
) => {
  const account = await StorageAccountModel.updateStatus(accountId, status);
  if (!account) throw new NotFoundException('Storage account not found');

  await AdminAuditModel.create({
    adminUserId,
    action: 'STORAGE_ACCOUNT_STATUS_UPDATE',
    entityType: 'STORAGE_ACCOUNT',
    entityId: accountId,
    metadata: { status },
  });

  return serializeStorageAccount(account);
};

export const disconnectAdminStorageAccountService = async (
  adminUser: Express.User,
  accountId: string,
) => {
  const result = await disconnectStorageAccountService(accountId, adminUser);

  await AdminAuditModel.create({
    adminUserId: adminUser._id,
    action: 'STORAGE_ACCOUNT_DISCONNECT',
    entityType: 'STORAGE_ACCOUNT',
    entityId: accountId,
    metadata: {
      deleted: result.deleted,
      provider: result.account.provider,
      ownerType: result.account.ownerType,
    },
  });

  return result;
};

export const removeAdminStorageAccountService = async (
  adminUserId: string,
  accountId: string,
) => {
  const account = await StorageAccountModel.findById(accountId);
  if (!account) throw new NotFoundException('Storage account not found');
  const deletedCount = await StorageAccountModel.delete(accountId);

  await AdminAuditModel.create({
    adminUserId,
    action: 'STORAGE_ACCOUNT_REMOVE',
    entityType: 'STORAGE_ACCOUNT',
    entityId: accountId,
    metadata: {
      provider: account.provider,
      ownerType: account.ownerType,
      deletedCount,
    },
  });

  return {
    deletedCount,
    account: serializeStorageAccount(account),
  };
};

export const listAdminApiKeysService = async (pagination: {
  pageSize: number;
  pageNumber: number;
}) => {
  const skip = (pagination.pageNumber - 1) * pagination.pageSize;
  const [apiKeys, totalCount] = await Promise.all([
    ApiKeyModel.findAllAdmin({
      limit: pagination.pageSize,
      offset: skip,
    }),
    ApiKeyModel.countAllAdmin(),
  ]);

  return {
    apiKeys,
    pagination: {
      pageSize: pagination.pageSize,
      pageNumber: pagination.pageNumber,
      totalCount,
      totalPages: Math.ceil(totalCount / pagination.pageSize),
      skip,
    },
  };
};

export const createAdminApiKeyService = async (
  adminUserId: string,
  userId: string,
  name: string,
) => {
  const { rawKey, hashedKey, displayKey } = generateAPIKey();
  await ApiKeyModel.create({
    userId,
    name,
    hashedKey,
    displayKey,
  });
  await AdminAuditModel.create({
    adminUserId,
    targetUserId: userId,
    action: 'API_KEY_CREATE',
    entityType: 'API_KEY',
    metadata: { name, displayKey },
  });
  return { rawKey };
};

export const deleteAdminApiKeyService = async (
  adminUserId: string,
  apiKeyId: string,
) => {
  const deletedCount = await ApiKeyModel.deleteById(apiKeyId);
  await AdminAuditModel.create({
    adminUserId,
    action: 'API_KEY_DELETE',
    entityType: 'API_KEY',
    entityId: apiKeyId,
  });
  return { deletedCount };
};

export {
  disconnectStorageAccountService,
  listProviderSettingsService,
  syncStorageAccountService,
  updateProviderSettingService,
};
