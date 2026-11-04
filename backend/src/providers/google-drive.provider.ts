import { Readable } from 'stream';
import { google } from 'googleapis';
import { Env } from '../config/env.config';
import FileModel, { FileDocument } from '../models/file.model';
import ProviderSettingsModel from '../models/provider-settings.model';
import StorageAccountModel, {
  StorageAccountDocument,
} from '../models/storage-account.model';
import { decryptJson, encryptJson } from '../utils/crypto';
import { BadRequestException } from '../utils/app-error';
import {
  ProviderItem,
  ProviderListOptions,
  StorageProvider,
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
   * Wrapper function that handles authentication errors and retries operations after forcing token refresh.
   * 
   * @param account - The storage account document
   * @param operation - Callback function that performs the Drive API operation
   * @returns The result of the operation
   * 
   * This wrapper:
   * - Executes the provided callback
   * - Catches GaxiosError with status 401 or 403 (authentication errors)
   * - On auth error, forces token refresh by clearing cached credentials
   * - Retries the callback once after refresh
   * - Only retries once to avoid infinite loops
   * - Logs retry attempts for debugging
   * - Non-auth errors (404, 500, etc.) skip retry and propagate immediately
   */
  private async executeWithAuthRetry<T>(
    account: StorageAccountDocument,
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      // First attempt: execute the operation
      return await operation();
    } catch (error: any) {
      // Check if this is an authentication error (401 or 403)
      const isAuthError = 
        error.response?.status === 401 || 
        error.response?.status === 403;
      
      if (!isAuthError) {
        // Non-auth errors propagate immediately without retry
        throw error;
      }
      
      // Log the authentication error and retry attempt
      console.warn(
        `Authentication error (${error.response?.status}) for Google Drive account ${account._id}. ` +
        `Forcing token refresh and retrying operation...`
      );
      
      // Force token refresh by clearing the cached credentials in the auth client
      // This will trigger a fresh token refresh on the next getDrive() call
      const accountId = account._id.toString();
      refreshInProgress.delete(accountId);
      
      // Mark credentials as needing refresh by clearing in-memory cache
      // The next getDrive() call will detect expired/missing tokens and refresh
      if (account.encryptedCredentials) {
        const credentials = decryptJson<GoogleAccountCredentials>(
          account.encryptedCredentials,
        );
        // Clear the access token to force refresh
        credentials.accessToken = undefined;
        credentials.expiryDate = undefined;
        
        // Update the database to force refresh on next call
        try {
          const encryptedCredentials = encryptJson({
            refreshToken: credentials.refreshToken,
            // accessToken and expiryDate intentionally omitted to force refresh
          });
          
          await StorageAccountModel.updateCredentials(account.id, {
            encryptedCredentials,
          });
          
          console.log(
            `Cleared cached tokens for account ${account._id} to force refresh`
          );
        } catch (dbError: any) {
          console.error(
            `Failed to clear cached tokens for account ${account._id}:`,
            dbError.message,
          );
        }
      }
      
      // Retry the operation once after forcing token refresh
      try {
        console.log(`Retrying operation after token refresh for account ${account._id}`);
        return await operation();
      } catch (retryError: any) {
        // If retry also fails, throw the error (no further retries to avoid loops)
        console.error(
          `Retry failed for Google Drive account ${account._id} after token refresh:`,
          retryError.message
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
          console.error(`Error waiting for existing refresh for account ${accountId}:`, error.message);
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
              console.log(`Token refreshed and stored for Google Drive account ${account._id}`);
            } catch (dbError: any) {
              // Log database update failures but don't fail the request
              // The refreshed token is still valid in memory for this request
              console.error(
                `Failed to store refreshed credentials for account ${account._id}:`,
                dbError.message,
              );
            }
          } catch (error: any) {
            // Handle token refresh failures
            console.error(`Failed to refresh token for account ${account._id}:`, error.message);
            
            // Re-throw with context for upstream error handling
            if (error.response?.data?.error === 'invalid_grant') {
              throw new BadRequestException('Google Drive token refresh failed: access has been revoked');
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
    parentId?: string | null,
  ) {
    const escapedName = this.escapeDriveQuery(name);
    const parent = parentId || 'root';
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
      parentId = await this.ensureDriveFolder(drive, name, parentId);
      createdPath.push({ name, id: parentId });
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
    file: Express.Multer.File,
    options: ProviderUploadOptions = {},
  ) {
    return this.executeWithAuthRetry(account, async () => {
      const folder = await this.ensureFolderPath(
        account,
        options.folderPath || [],
        options.providerFolderId || null,
      );
      const drive = folder.drive;
      const parentId = folder.folderId || options.providerFolderId || account.rootFolderId;
      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          ...(parentId && { parents: [parentId] }),
        },
        media: {
          mimeType: file.mimetype,
          body: Readable.from(file.buffer),
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
          folderPath: folder.path,
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
