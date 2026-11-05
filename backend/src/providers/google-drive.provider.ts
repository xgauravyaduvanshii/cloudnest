import { Readable } from 'stream';
import { google } from 'googleapis';
import { Env } from '../config/env.config';
import FileModel, { FileDocument } from '../models/file.model';
import ProviderSettingsModel from '../models/provider-settings.model';
import StorageAccountModel, {
  StorageAccountDocument,
} from '../models/storage-account.model';
import { decryptJson, encryptJson } from '../utils/crypto';
import {
  BadRequestException,
  ConflictException,
} from '../utils/app-error';
import { ErrorCodeEnum } from '../enums/error-code.enum';
import { logger } from '../utils/logger';
import { getUploadStream } from '../utils/upload-source';
import DriveFolderCacheModel from '../models/drive-folder-cache.model';
import { classifyDriveError } from './provider-error';
import {
  ProviderItem,
  ProviderListOptions,
  StorageProvider,
  ProviderUploadInput,
  ProviderUploadOptions,
} from './storage-provider';

/**
 * Credentials for authenticating with Google Drive OAuth2.
 * 
 * @property {string} refreshToken - Long-lived refresh token used to obtain new access tokens
 * @property {string} [accessToken] - Short-lived access token (typically expires after 1 hour)
 * @property {number} [expiryDate] - Unix timestamp in milliseconds when the access token expires
 */
interface GoogleAccountCredentials {
  refreshToken: string;
  accessToken?: string;
  expiryDate?: number;
}

interface GoogleProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export const GOOGLE_DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
];

export const getGoogleProviderConfig = async (): Promise<GoogleProviderConfig> => {
  const setting = await ProviderSettingsModel.findByProvider('GOOGLE_DRIVE');
  if (setting?.encryptedConfig) {
    return decryptJson<GoogleProviderConfig>(setting.encryptedConfig);
  }

  return {
    clientId: Env.GOOGLE_CLIENT_ID,
    clientSecret: Env.GOOGLE_CLIENT_SECRET,
    redirectUri: Env.GOOGLE_REDIRECT_URI,
  };
};

export const createGoogleOAuthClient = async () => {
  const config = await getGoogleProviderConfig();
  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new BadRequestException('Google Drive provider is not configured');
  }

  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri,
  );
};

// Module-level Map to track ongoing token refresh operations per account
// This prevents race conditions when multiple concurrent requests trigger refresh for the same account
const refreshInProgress = new Map<string, Promise<void>>();

export class GoogleDriveStorageProvider implements StorageProvider {
  /**
   * Wrapper that retries an operation once after forcing a token refresh, but ONLY
   * for genuine authentication errors (401, or a 403 whose reason is auth-related).
   *
   * Rate-limit (429 / rateLimitExceeded / userRateLimitExceeded) and quota errors are
   * deliberately NOT treated as auth failures: clearing the cached access token for
   * them would force needless refreshes and could invalidate healthy credentials. Those
   * errors bubble up unchanged so the upload worker can apply exponential backoff + jitter
   * and honor Retry-After. Non-retryable client errors (404, etc.) also bubble up.
   */
  private async executeWithAuthRetry<T>(
    account: StorageAccountDocument,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const classified = classifyDriveError(error);

      // Only authentication errors warrant clearing cached tokens and refreshing.
      if (classified.kind !== 'AUTH') {
        throw error;
      }

      logger.warn(
        `Authentication error (${classified.status}) for Google Drive account ${account._id}. ` +
          `Forcing token refresh and retrying operation once...`,
      );

      // Force token refresh by clearing the cached credentials in the auth client.
      // The next getDrive() call will detect expired/missing tokens and refresh.
      const accountId = account._id.toString();
      refreshInProgress.delete(accountId);

      if (account.encryptedCredentials) {
        const credentials = decryptJson<GoogleAccountCredentials>(
          account.encryptedCredentials,
        );
        credentials.accessToken = undefined;
        credentials.expiryDate = undefined;

        try {
          const encryptedCredentials = encryptJson({
            refreshToken: credentials.refreshToken,
            // accessToken and expiryDate intentionally omitted to force refresh
          });

          await StorageAccountModel.updateCredentials(account.id, {
            encryptedCredentials,
          });

          logger.info(
            `Cleared cached tokens for account ${account._id} to force refresh`,
          );
        } catch (dbError: any) {
          logger.error(
            `Failed to clear cached tokens for account ${account._id}: ${dbError?.message}`,
          );
        }
      }

      // Retry the operation once after forcing token refresh (no further retries).
      try {
        return await operation();
      } catch (retryError: any) {
        logger.error(
          `Retry failed for Google Drive account ${account._id} after token refresh: ${retryError?.message}`,
        );
        throw retryError;
      }
    }
  }
  private readonly googleWorkspaceExportMap: Record<string, string> = {
    'application/vnd.google-apps.document': 'application/pdf',
    'application/vnd.google-apps.spreadsheet': 'application/pdf',
    'application/vnd.google-apps.presentation': 'application/pdf',
    'application/vnd.google-apps.drawing': 'image/png',
  };

  private async getDrive(account: StorageAccountDocument) {
    if (!account.encryptedCredentials) {
      throw new BadRequestException('Google Drive account is missing credentials');
    }

    const credentials = decryptJson<GoogleAccountCredentials>(
      account.encryptedCredentials,
    );
    const auth = await createGoogleOAuthClient();
    
    // Set all available credentials on OAuth2 client
    auth.setCredentials({
      refresh_token: credentials.refreshToken,
      access_token: credentials.accessToken,
      expiry_date: credentials.expiryDate,
    });

    // Check if token refresh is needed
    const needsRefresh = 
      !credentials.accessToken || 
      !credentials.expiryDate || 
      Date.now() >= credentials.expiryDate - 5 * 60 * 1000; // 5 minutes before expiry

    if (needsRefresh) {
      const accountId = account._id.toString();
      
      // Check if refresh is already in progress for this account
      const existingRefresh = refreshInProgress.get(accountId);
      if (existingRefresh) {
        // Wait for the existing refresh to complete before proceeding
        try {
          await Promise.race([
            existingRefresh,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Token refresh timeout')), 10000)
            )
          ]);
        } catch (error: any) {
          logger.error(
            `Error waiting for existing refresh for account ${accountId}: ${error?.message}`,
          );
        }
        
        // After waiting, reload credentials from database to get the refreshed tokens
        const updatedAccount = await StorageAccountModel.findById(account._id);
        if (updatedAccount?.encryptedCredentials) {
          const updatedCredentials = decryptJson<GoogleAccountCredentials>(
            updatedAccount.encryptedCredentials,
          );
          // Set the refreshed credentials on the auth client
          auth.setCredentials({
            refresh_token: updatedCredentials.refreshToken,
            access_token: updatedCredentials.accessToken,
            expiry_date: updatedCredentials.expiryDate,
          });
        }
      } else {
        // No refresh in progress, create a new refresh promise
        const refreshPromise = (async () => {
          try {
            // Trigger token refresh using the OAuth2 client
            await auth.getAccessToken();
            
            // Extract new credentials from auth client
            const newCredentials = auth.credentials;
            
            // Update credentials object with new tokens
            if (newCredentials.access_token) {
              credentials.accessToken = newCredentials.access_token;
            }
            if (newCredentials.expiry_date) {
              credentials.expiryDate = newCredentials.expiry_date;
            }
            
            // Store refreshed credentials back to database
            try {
              const encryptedCredentials = encryptJson({
                refreshToken: credentials.refreshToken,
                accessToken: credentials.accessToken,
                expiryDate: credentials.expiryDate,
              });
              
              await StorageAccountModel.updateCredentials(account.id, {
                encryptedCredentials,
              });
              
              // Log successful credential update for audit trail
              logger.info(`Token refreshed and stored for Google Drive account ${account._id}`);
            } catch (dbError: any) {
              // Log database update failures but don't fail the request
              // The refreshed token is still valid in memory for this request
              logger.error(
                `Failed to store refreshed credentials for account ${account._id}: ${dbError?.message}`,
              );
            }
          } catch (error: any) {
            // Handle token refresh failures
            logger.error(`Failed to refresh token for account ${account._id}: ${error?.message}`);
            
            // Re-throw with context for upstream error handling. A revoked/expired
            // grant is a genuine auth failure that requires the user to reconnect,
            // so surface it as a typed 409 rather than a generic 400.
            if (error.response?.data?.error === 'invalid_grant') {
              throw new ConflictException(
                'Google Drive access was revoked or expired. Please reconnect your Google account.',
                ErrorCodeEnum.GOOGLE_REAUTH_REQUIRED,
              );
            }
            throw error;
          }
        })();
        
        // Store the refresh promise in the map
        refreshInProgress.set(accountId, refreshPromise);
        
        try {
          // Wait for the refresh to complete with timeout
          await Promise.race([
            refreshPromise,
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Token refresh timeout after 10 seconds')), 10000)
            )
          ]);
        } finally {
          // Always remove from map when done (success or failure)
          refreshInProgress.delete(accountId);
        }
      }
    }

    return google.drive({
      version: 'v3',
      auth,
    });
  }

  private escapeDriveQuery(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private toProviderItem(file: any): ProviderItem {
    const mimeType = file.mimeType || 'application/octet-stream';
    return {
      id: file.id,
      name: file.name || 'Untitled',
      mimeType,
      size: file.size ? Number(file.size) : 0,
      isFolder: mimeType === 'application/vnd.google-apps.folder',
      createdAt: file.createdTime || null,
      updatedAt: file.modifiedTime || null,
      webViewLink: file.webViewLink || null,
      webContentLink: file.webContentLink || null,
      thumbnailLink: file.thumbnailLink || null,
      parents: file.parents || [],
    };
  }

  private async ensureDriveFolder(
    drive: ReturnType<typeof google.drive>,
    name: string,
    parentId: string | null | undefined,
    account: StorageAccountDocument,
  ) {
    const escapedName = this.escapeDriveQuery(name);
    const parent = parentId || 'root';
    // Race-safe: consult the cache and serialize creation with an advisory lock so
    // concurrent uploads/workers never create duplicate folders of the same name.
    return DriveFolderCacheModel.ensure({
      storageAccountId: account.id,
      parentFolderId: parent,
      name,
      createRemote: async () => {
        const response = await drive.files.list({
          q: [
            "mimeType = 'application/vnd.google-apps.folder'",
            `name = '${escapedName}'`,
            'trashed = false',
            `'${parent}' in parents`,
          ].join(' and '),
          fields: 'files(id,name)',
          pageSize: 1,
          spaces: 'drive',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
        });

        const existingId = response.data.files?.[0]?.id;
        if (existingId) return existingId;

        const created = await drive.files.create({
          requestBody: {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parent],
          },
          fields: 'id,name',
          supportsAllDrives: true,
        });
        if (!created.data.id) {
          throw new BadRequestException('Google Drive did not return a folder ID');
        }
        return created.data.id;
      },
    });
  }

  private async ensureFolderPath(
    account: StorageAccountDocument,
    folderPath: string[] = [],
    baseFolderId?: string | null,
  ) {
    const drive = await this.getDrive(account);
    let parentId = baseFolderId || account.rootFolderId || null;
    const createdPath: { name: string; id: string }[] = [];

    for (const rawName of folderPath) {
      const name = rawName.trim();
      if (!name) continue;
      parentId = await this.ensureDriveFolder(drive, name, parentId, account);
      createdPath.push({ name, id: parentId! });
    }

    return {
      drive,
      folderId: parentId,
      path: createdPath,
    };
  }

  async ensureFolder(
    account: StorageAccountDocument,
    userId: string,
    folderPath: string[],
  ) {
    const result = await this.ensureFolderPath(account, folderPath);
    return {
      providerFolderId: result.folderId,
      folderPath: result.path,
    };
  }

  async upload(
    account: StorageAccountDocument,
    userId: string,
    file: ProviderUploadInput,
    options: ProviderUploadOptions = {},
  ) {
    return this.executeWithAuthRetry(account, async () => {
      const baseFolderId = options.providerFolderId || account.rootFolderId || null;
      // FLAT drops every file into the single selected folder and must never create a
      // new folder of the same name. PRESERVE_STRUCTURE (and the legacy path) recreates
      // the given relative folder chain only *inside* the selected base folder.
      const shouldEnsureSubfolders =
        options.mode !== 'FLAT' && (options.folderPath?.length ?? 0) > 0;

      let drive: ReturnType<typeof google.drive>;
      let parentId: string | null = baseFolderId;
      let folderPathInfo: { name: string; id: string }[] = [];

      if (shouldEnsureSubfolders) {
        const ensured = await this.ensureFolderPath(
          account,
          options.folderPath || [],
          baseFolderId,
        );
        drive = ensured.drive;
        parentId = ensured.folderId || baseFolderId;
        folderPathInfo = ensured.path;
      } else {
        drive = await this.getDrive(account);
      }

      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          ...(parentId && { parents: [parentId] }),
        },
        media: {
          mimeType: file.mimetype,
          body: getUploadStream(file),
        },
        fields: 'id,name,mimeType,size,webViewLink,webContentLink',
        supportsAllDrives: true,
      });

      const fileId = response.data.id;
      if (!fileId) {
        throw new BadRequestException('Google Drive did not return a file ID');
      }

      return {
        storageKey: `google-drive/${account.id}/${fileId}`,
        providerFileId: fileId,
        metadata: {
          id: fileId,
          name: response.data.name,
          mimeType: response.data.mimeType,
          webViewLink: response.data.webViewLink,
          webContentLink: response.data.webContentLink,
          folderId: parentId || null,
          folderPath: folderPathInfo,
        },
      };
    });
  }

  async getReadStream(account: StorageAccountDocument, file: FileDocument) {
    const fileId = file.providerFileId;
    if (!fileId) throw new BadRequestException('Google Drive file ID missing');
    return this.getItemReadStream(account, fileId);
  }

  async getItemReadStream(account: StorageAccountDocument, itemId: string) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      const metadata = await drive.files.get({
        fileId: itemId,
        fields: 'id,name,mimeType,size',
        supportsAllDrives: true,
      });
      const mimeType = metadata.data.mimeType || 'application/octet-stream';
      const exportMimeType = this.googleWorkspaceExportMap[mimeType];

      if (exportMimeType) {
        const response = await drive.files.export(
          {
            fileId: itemId,
            mimeType: exportMimeType,
          },
          {
            responseType: 'stream',
          },
        );

        return {
          stream: response.data as Readable,
          contentType: exportMimeType,
        };
      }

      if (mimeType.startsWith('application/vnd.google-apps.')) {
        throw new BadRequestException('This Google Drive file type cannot be previewed inline');
      }

      const response = await drive.files.get(
        {
          fileId: itemId,
          alt: 'media',
          supportsAllDrives: true,
        },
        {
          responseType: 'stream',
        },
      );
      return {
        stream: response.data as Readable,
        contentType: mimeType,
        fileSize: metadata.data.size ? Number(metadata.data.size) : undefined,
      };
    });
  }

  async delete(account: StorageAccountDocument, file: FileDocument) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      if (!file.providerFileId) {
        throw new BadRequestException('Google Drive file ID missing');
      }
      await drive.files.delete({
        fileId: file.providerFileId,
        supportsAllDrives: true,
      });
    });
  }

  async listItems(
    account: StorageAccountDocument,
    options: ProviderListOptions = {},
  ) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      const requestedFolderId =
        options.folderId && !['null', 'undefined'].includes(options.folderId)
          ? options.folderId
          : null;
      const parentId = requestedFolderId || account.rootFolderId || 'root';
      const queryParts = [
        `'${this.escapeDriveQuery(parentId)}' in parents`,
        'trashed = false',
      ];

      if (options.keyword?.trim()) {
        queryParts.push(`name contains '${this.escapeDriveQuery(options.keyword.trim())}'`);
      }

      const response = await drive.files.list({
        q: queryParts.join(' and '),
        fields:
          'nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,parents)',
        orderBy: 'folder,name',
        pageSize: Math.min(Math.max(options.pageSize || 100, 1), 100),
        pageToken: options.pageToken || undefined,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      const items = (response.data.files || []).map((file) =>
        this.toProviderItem(file),
      );

      return {
        folders: items.filter((item) => item.isFolder),
        files: items.filter((item) => !item.isFolder),
        nextPageToken: response.data.nextPageToken || null,
      };
    });
  }

  async createFolderItem(
    account: StorageAccountDocument,
    name: string,
    parentId?: string | null,
  ) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      const parent = parentId || account.rootFolderId || 'root';
      const created = await drive.files.create({
        requestBody: {
          name,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [parent],
        },
        fields:
          'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,parents',
        supportsAllDrives: true,
      });

      return this.toProviderItem(created.data);
    });
  }

  async moveItem(
    account: StorageAccountDocument,
    itemId: string,
    targetFolderId?: string | null,
  ) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      const current = await drive.files.get({
        fileId: itemId,
        fields: 'parents',
        supportsAllDrives: true,
      });
      const previousParents = (current.data.parents || []).join(',');
      const targetParent = targetFolderId || account.rootFolderId || 'root';

      const moved = await drive.files.update({
        fileId: itemId,
        addParents: targetParent,
        removeParents: previousParents || undefined,
        fields:
          'id,name,mimeType,size,createdTime,modifiedTime,webViewLink,webContentLink,thumbnailLink,parents',
        supportsAllDrives: true,
      });

      return this.toProviderItem(moved.data);
    });
  }

  async deleteItem(account: StorageAccountDocument, itemId: string) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      await drive.files.delete({
        fileId: itemId,
        supportsAllDrives: true,
      });
    });
  }

  async syncUsage(account: StorageAccountDocument) {
    return this.executeWithAuthRetry(account, async () => {
      const drive = await this.getDrive(account);
      const [about, appUsage] = await Promise.all([
        drive.about.get({
          fields:
            'user(displayName,emailAddress,permissionId),storageQuota(limit,usage,usageInDrive,usageInDriveTrash),maxUploadSize',
        }),
        StorageAccountModel.calculateAppUsage(account.id),
      ]);
      const quota = about.data.storageQuota;
      const usageBytes = Number(quota?.usage || appUsage || 0);
      const limitBytes = quota?.limit ? Number(quota.limit) : null;

      return {
        usageBytes,
        limitBytes,
        details: {
          user: about.data.user,
          maxUploadSize: about.data.maxUploadSize,
          usageInDrive: quota?.usageInDrive ? Number(quota.usageInDrive) : null,
          usageInDriveTrash: quota?.usageInDriveTrash
            ? Number(quota.usageInDriveTrash)
            : null,
          appManagedUsage: appUsage,
        },
      };
    });
  }
}
