import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Api } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Env } from '../config/env.config';
import ProviderSettingsModel from '../models/provider-settings.model';
import StorageAccountModel, {
  StorageAccountDocument,
  StorageOwnerType,
  StorageProviderType,
} from '../models/storage-account.model';
import { decryptJson, encryptJson } from '../utils/crypto';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';
import {
  createGoogleOAuthClient,
  GOOGLE_DRIVE_SCOPES,
} from '../providers/google-drive.provider';
import {
  createTelegramClient,
  getTelegramCredentials,
} from '../providers/telegram.provider';
import { getStorageProvider } from '../providers';
import { logger } from '../utils/logger';

type GoogleState = {
  userId: string;
  ownerType: StorageOwnerType;
};

type PendingTelegramAuth = {
  client: Awaited<ReturnType<typeof createTelegramClient>>;
  userId: string;
  ownerType: StorageOwnerType;
  phoneNumber: string;
  phoneCodeHash: string;
  isCodeViaApp: boolean;
  expiresAt: number;
};

type GoogleAccountCredentials = {
  refreshToken?: string;
};

type TelegramAccountCredentials = {
  session?: string;
};

const pendingTelegramAuths = new Map<string, PendingTelegramAuth>();

const assertAccountAccess = (
  account: StorageAccountDocument,
  user: Express.User,
) => {
  const isAdmin = user.role === 'ADMIN';
  if (isAdmin) return;
  if (account.ownerType === 'USER' && account.userId === user._id) return;
  throw new UnauthorizedException('Storage account access denied');
};

const assertAccountAvailableForUser = (
  account: StorageAccountDocument,
  userId: string,
) => {
  if (account.ownerType === 'USER' && account.userId === userId) return;
  if (account.ownerType === 'ADMIN') return;
  throw new UnauthorizedException('Storage account access denied');
};

const toPublicStorageAccount = (account: StorageAccountDocument) => ({
  _id: account.id,
  id: account.id,
  userId: account.userId,
  ownerType: account.ownerType,
  provider: account.provider,
  displayName: account.displayName,
  status: account.status,
  externalAccountId: account.externalAccountId,
  externalEmail: account.externalEmail,
  softQuotaBytes: account.softQuotaBytes,
  cachedUsageBytes: account.cachedUsageBytes,
  cachedLimitBytes: account.cachedLimitBytes,
  cachedUsageDetails: account.cachedUsageDetails,
  lastSyncedAt: account.lastSyncedAt,
  errorMessage: account.errorMessage,
  createdAt: account.createdAt,
  updatedAt: account.updatedAt,
});

export const serializeStorageAccount = toPublicStorageAccount;

const revokeProviderSession = async (account: StorageAccountDocument) => {
  if (!account.encryptedCredentials) return;

  try {
    if (account.provider === 'GOOGLE_DRIVE') {
      const credentials = decryptJson<GoogleAccountCredentials>(
        account.encryptedCredentials,
      );
      if (!credentials.refreshToken) return;
      const auth = await createGoogleOAuthClient();
      await auth.revokeToken(credentials.refreshToken);
      return;
    }

    if (account.provider === 'TELEGRAM') {
      const credentials = decryptJson<TelegramAccountCredentials>(
        account.encryptedCredentials,
      );
      if (!credentials.session) return;
      const client = await createTelegramClient(credentials.session);
      try {
        await client.connect();
        await client.invoke(new Api.auth.LogOut());
      } finally {
        await client.disconnect();
      }
    }
  } catch (error) {
    logger.warn('Failed to revoke provider session during disconnect', {
      accountId: account.id,
      provider: account.provider,
      error: error instanceof Error ? error.message : error,
    });
  }
};

export const ensureDefaultS3StorageAccount = async () => {
  const existing = await StorageAccountModel.findDefaultS3Admin();
  if (existing) return existing;

  return StorageAccountModel.create({
    ownerType: 'ADMIN',
    provider: 'S3',
    displayName: 'Default S3 Storage',
    status: 'ACTIVE',
    externalAccountId: 'default-s3',
    cachedUsageDetails: {
      source: 'bootstrap',
    },
  });
};

export const isProviderEnabledService = async (
  provider: StorageProviderType,
) => {
  const setting = await ProviderSettingsModel.findByProvider(provider);
  return setting?.isEnabled !== false;
};

export const assertProviderEnabledService = async (
  provider: StorageProviderType,
) => {
  const isEnabled = await isProviderEnabledService(provider);
  if (!isEnabled) {
    throw new BadRequestException(`${provider} provider is turned off`);
  }
};

export const listStorageAccountsService = async (user: Express.User) => {
  const accounts = await StorageAccountModel.findAll({
    limit: 100,
    offset: 0,
  });

  return accounts
    .filter(
      (account) =>
        account.status !== 'DISABLED' &&
        (account.ownerType === 'ADMIN' || account.userId === user._id),
    )
    .map(toPublicStorageAccount);
};

export const listEnabledProvidersService = async () => {
  const settings = await ProviderSettingsModel.findAll();
  const knownProviders: StorageProviderType[] = ['S3', 'GOOGLE_DRIVE', 'TELEGRAM'];
  return knownProviders.map((provider) => {
    const setting = settings.find((item) => item.provider === provider);
    return {
      provider,
      isEnabled: setting?.isEnabled !== false,
      isConfigured: setting?.isConfigured ?? provider === 'S3',
    };
  });
};

export const chooseStorageAccountForUpload = async (
  userId: string,
  totalFileSize: number,
  preferredProvider?: StorageProviderType,
  preferredStorageAccountId?: string | null,
) => {
  if (!preferredProvider || preferredProvider === 'S3') {
    await ensureDefaultS3StorageAccount();
  }
  if (preferredProvider) {
    await assertProviderEnabledService(preferredProvider);
  }

  if (preferredStorageAccountId) {
    const account = await StorageAccountModel.findById(preferredStorageAccountId);
    if (!account) throw new NotFoundException('Storage account not found');
    assertAccountAvailableForUser(account, userId);
    if (account.status !== 'ACTIVE') {
      throw new BadRequestException('Selected storage account is not active');
    }
    if (preferredProvider && account.provider !== preferredProvider) {
      throw new BadRequestException('Selected storage account provider mismatch');
    }
    await assertProviderEnabledService(account.provider);

    const appUsage = await StorageAccountModel.calculateAppUsage(account.id);
    let remaining = Number.MAX_SAFE_INTEGER;
    if (account.provider === 'TELEGRAM' || account.provider === 'S3') {
      remaining =
        account.softQuotaBytes === null
          ? Number.MAX_SAFE_INTEGER
          : account.softQuotaBytes - appUsage;
    } else if (account.cachedLimitBytes !== null) {
      remaining = account.cachedLimitBytes - account.cachedUsageBytes;
    } else if (account.softQuotaBytes !== null) {
      remaining = account.softQuotaBytes - appUsage;
    }

    if (remaining < totalFileSize) {
      throw new BadRequestException('Selected storage account does not have enough space');
    }
    return account;
  }

  const providerSettings = await ProviderSettingsModel.findAll();
  const disabledProviders = new Set(
    providerSettings
      .filter((setting) => setting.isEnabled === false)
      .map((setting) => setting.provider),
  );
  const accounts = (await StorageAccountModel.findEligibleForUser(userId)).filter(
    (account) =>
      !disabledProviders.has(account.provider) &&
      (!preferredProvider || account.provider === preferredProvider),
  );
  if (!accounts.length) {
    throw new BadRequestException(
      preferredProvider
        ? `No active ${preferredProvider} storage account is available`
        : 'No active storage accounts are available',
    );
  }

  const scoredAccounts = await Promise.all(
    accounts.map(async (account) => {
      const appUsage = await StorageAccountModel.calculateAppUsage(account.id);
      let remaining = Number.MAX_SAFE_INTEGER;

      if (account.provider === 'TELEGRAM' || account.provider === 'S3') {
        remaining =
          account.softQuotaBytes === null
            ? Number.MAX_SAFE_INTEGER
            : account.softQuotaBytes - appUsage;
      } else if (account.cachedLimitBytes !== null) {
        remaining = account.cachedLimitBytes - account.cachedUsageBytes;
      } else if (account.softQuotaBytes !== null) {
        remaining = account.softQuotaBytes - appUsage;
      }

      return {
        account,
        remaining,
      };
    }),
  );

  const best = scoredAccounts
    .filter(({ remaining }) => remaining >= totalFileSize)
    .sort((a, b) => b.remaining - a.remaining)[0];

  if (!best) {
    throw new BadRequestException('No connected storage account has enough space');
  }

  return best.account;
};

export const syncStorageAccountService = async (
  accountId: string,
  user: Express.User,
) => {
  const account = await StorageAccountModel.findById(accountId);
  if (!account) throw new NotFoundException('Storage account not found');
  assertAccountAccess(account, user);

  try {
    const provider = getStorageProvider(account.provider);
    const usage = await provider.syncUsage(account);
    const updated = await StorageAccountModel.updateUsage(account.id, {
      usageBytes: usage.usageBytes,
      limitBytes: usage.limitBytes,
      usageDetails: usage.details,
      status: 'ACTIVE',
      errorMessage: null,
    });
    return toPublicStorageAccount(updated!);
  } catch (error) {
    logger.error('Failed to sync storage account', error);
    await StorageAccountModel.updateStatus(
      account.id,
      'ERROR',
      error instanceof Error ? error.message : 'Unknown sync error',
    );
    throw error;
  }
};

export const disconnectStorageAccountService = async (
  accountId: string,
  user: Express.User,
) => {
  const account = await StorageAccountModel.findById(accountId);
  if (!account) throw new NotFoundException('Storage account not found');
  assertAccountAccess(account, user);

  await revokeProviderSession(account);

  const usageBytes = await StorageAccountModel.calculateAppUsage(account.id);
  if (usageBytes === 0) {
    await StorageAccountModel.delete(account.id);
    return {
      deleted: true,
      account: toPublicStorageAccount({
        ...account,
        status: 'DISABLED',
        encryptedCredentials: null,
        externalAccountId: null,
        externalEmail: null,
      }),
    };
  }

  const updated = await StorageAccountModel.updateCredentials(account.id, {
    encryptedCredentials: null,
    status: 'DISABLED',
    externalAccountId: null,
    externalEmail: null,
  });
  return {
    deleted: false,
    account: toPublicStorageAccount(updated!),
  };
};

export const getGoogleAuthUrlService = async (
  user: Express.User,
  ownerType: StorageOwnerType = 'USER',
) => {
  if (ownerType === 'ADMIN' && user.role !== 'ADMIN') {
    throw new UnauthorizedException('Admin access required');
  }
  await assertProviderEnabledService('GOOGLE_DRIVE');

  const auth = await createGoogleOAuthClient();
  const state = jwt.sign(
    {
      userId: user._id,
      ownerType,
    } satisfies GoogleState,
    Env.JWT_SECRET,
    { expiresIn: '15m', audience: ['google-drive-oauth'] },
  );

  return {
    url: auth.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: GOOGLE_DRIVE_SCOPES,
      include_granted_scopes: true,
      state,
    }),
  };
};

export const handleGoogleCallbackService = async (
  code: string,
  state: string,
) => {
  let decoded: GoogleState;
  try {
    decoded = jwt.verify(state, Env.JWT_SECRET, {
      audience: ['google-drive-oauth'],
    }) as GoogleState;
  } catch {
    throw new BadRequestException('Invalid Google OAuth state');
  }

  const auth = await createGoogleOAuthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    throw new BadRequestException(
      'Google did not return a refresh token. Revoke access and try again.',
    );
  }

  auth.setCredentials(tokens);
  const drive = await import('googleapis').then(({ google }) =>
    google.drive({ version: 'v3', auth }),
  );
  const about = await drive.about.get({
    fields:
      'user(displayName,emailAddress,permissionId),storageQuota(limit,usage,usageInDrive,usageInDriveTrash)',
  });

  const account = await StorageAccountModel.create({
    userId: decoded.ownerType === 'USER' ? decoded.userId : null,
    ownerType: decoded.ownerType,
    provider: 'GOOGLE_DRIVE',
    displayName:
      about.data.user?.displayName ||
      about.data.user?.emailAddress ||
      'Google Drive',
    status: 'ACTIVE',
    encryptedCredentials: encryptJson({
      refreshToken: tokens.refresh_token,
    }),
    externalAccountId: about.data.user?.permissionId || null,
    externalEmail: about.data.user?.emailAddress || null,
    cachedUsageBytes: Number(about.data.storageQuota?.usage || 0),
    cachedLimitBytes: about.data.storageQuota?.limit
      ? Number(about.data.storageQuota.limit)
      : null,
    cachedUsageDetails: {
      usageInDrive: about.data.storageQuota?.usageInDrive
        ? Number(about.data.storageQuota.usageInDrive)
        : null,
      usageInDriveTrash: about.data.storageQuota?.usageInDriveTrash
        ? Number(about.data.storageQuota.usageInDriveTrash)
        : null,
    },
  });

  return account;
};

export const startTelegramAuthService = async (
  user: Express.User,
  input: {
    phoneNumber: string;
    ownerType?: StorageOwnerType;
  },
) => {
  const ownerType = input.ownerType || 'USER';
  if (ownerType === 'ADMIN' && user.role !== 'ADMIN') {
    throw new UnauthorizedException('Admin access required');
  }
  await assertProviderEnabledService('TELEGRAM');

  const authId = crypto.randomUUID();
  const client = await createTelegramClient('');
  await client.connect();
  const credentials = await getTelegramCredentials();
  const { phoneCodeHash, isCodeViaApp } = await client.sendCode(
    credentials,
    input.phoneNumber,
  );

  pendingTelegramAuths.set(authId, {
    client,
    userId: user._id,
    ownerType,
    phoneNumber: input.phoneNumber,
    phoneCodeHash,
    isCodeViaApp,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return {
    authId,
    isCodeViaApp,
    nextStep: 'CODE',
  };
};

const getPendingTelegramAuth = (authId: string) => {
  const pending = pendingTelegramAuths.get(authId);
  if (!pending || pending.expiresAt < Date.now()) {
    pendingTelegramAuths.delete(authId);
    throw new BadRequestException('Telegram login session expired');
  }
  return pending;
};

const createTelegramStorageAccount = async (
  pending: PendingTelegramAuth,
  user: Api.TypeUser,
) => {
  const session = pending.client.session.save() + '';
  const anyUser = user as any;
  const firstName = anyUser.firstName || '';
  const lastName = anyUser.lastName || '';
  const displayName =
    `${firstName} ${lastName}`.trim() || anyUser.username || 'Telegram';
  const externalId = anyUser.id?.valueOf().toString() || null;

  const account = await StorageAccountModel.create({
    userId: pending.ownerType === 'USER' ? pending.userId : null,
    ownerType: pending.ownerType,
    provider: 'TELEGRAM',
    displayName,
    status: 'ACTIVE',
    encryptedCredentials: encryptJson({ session }),
    externalAccountId: externalId,
    externalEmail: anyUser.username || null,
    cachedUsageDetails: {
      source: 'app_files',
    },
  });

  await pending.client.disconnect();
  return account;
};

export const verifyTelegramCodeService = async (
  authId: string,
  code: string,
) => {
  const pending = getPendingTelegramAuth(authId);

  try {
    const result = await pending.client.invoke(
      new Api.auth.SignIn({
        phoneNumber: pending.phoneNumber,
        phoneCodeHash: pending.phoneCodeHash,
        phoneCode: code,
      }),
    );
    if (result instanceof Api.auth.AuthorizationSignUpRequired) {
      throw new BadRequestException('Telegram account signup is not supported');
    }
    const account = await createTelegramStorageAccount(pending, result.user);
    pendingTelegramAuths.delete(authId);

    return {
      nextStep: 'DONE',
      account: toPublicStorageAccount(account),
    };
  } catch (error: any) {
    if (error?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      return {
        nextStep: 'PASSWORD',
      };
    }
    throw error;
  }
};

export const verifyTelegramPasswordService = async (
  authId: string,
  password: string,
) => {
  const pending = getPendingTelegramAuth(authId);
  const credentials = await getTelegramCredentials();
  const user = await pending.client.signInWithPassword(credentials, {
    password: async () => password,
    onError: (error) => {
      throw error;
    },
  });
  const account = await createTelegramStorageAccount(pending, user);
  pendingTelegramAuths.delete(authId);

  return {
    nextStep: 'DONE',
    account: toPublicStorageAccount(account),
  };
};

export const updateProviderSettingService = async (
  user: Express.User,
  provider: StorageProviderType,
  config: Record<string, unknown>,
) => {
  if (user.role !== 'ADMIN') throw new UnauthorizedException('Admin required');
  const { isEnabled, ...providerConfig } = config as Record<string, unknown> & {
    isEnabled?: unknown;
  };
  const cleanedConfig = Object.fromEntries(
    Object.entries(providerConfig).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  );
  const hasConfig = Object.keys(cleanedConfig).length > 0;
  const existing = await ProviderSettingsModel.findByProvider(provider);

  const setting = await ProviderSettingsModel.upsert({
    provider,
    encryptedConfig: hasConfig ? encryptJson(cleanedConfig) : undefined,
    isConfigured: hasConfig ? true : existing?.isConfigured ?? false,
    isEnabled:
      typeof isEnabled === 'boolean' ? isEnabled : existing?.isEnabled ?? true,
    updatedBy: user._id,
  });

  return {
    provider: setting.provider,
    isConfigured: setting.isConfigured,
    isEnabled: setting.isEnabled,
    updatedAt: setting.updatedAt,
  };
};

export const listProviderSettingsService = async () => {
  const settings = await ProviderSettingsModel.findAll();
  return settings.map((setting) => ({
    provider: setting.provider,
    isConfigured: setting.isConfigured,
    isEnabled: setting.isEnabled,
    updatedAt: setting.updatedAt,
  }));
};
