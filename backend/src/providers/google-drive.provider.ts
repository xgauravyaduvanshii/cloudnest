import { Readable } from 'stream';
import { google } from 'googleapis';
import { Env } from '../config/env.config';
import FileModel, { FileDocument } from '../models/file.model';
import ProviderSettingsModel from '../models/provider-settings.model';
import StorageAccountModel, {
  StorageAccountDocument,
} from '../models/storage-account.model';
import { decryptJson } from '../utils/crypto';
import { BadRequestException } from '../utils/app-error';
import {
  ProviderItem,
  ProviderListOptions,
  StorageProvider,
  ProviderUploadOptions,
} from './storage-provider';

interface GoogleAccountCredentials {
  refreshToken: string;
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

export class GoogleDriveStorageProvider implements StorageProvider {
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
    auth.setCredentials({
      refresh_token: credentials.refreshToken,
    });

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
  }

  async getReadStream(account: StorageAccountDocument, file: FileDocument) {
    const fileId = file.providerFileId;
    if (!fileId) throw new BadRequestException('Google Drive file ID missing');
    return this.getItemReadStream(account, fileId);
  }

  async getItemReadStream(account: StorageAccountDocument, itemId: string) {
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
  }

  async delete(account: StorageAccountDocument, file: FileDocument) {
    const drive = await this.getDrive(account);
    if (!file.providerFileId) {
      throw new BadRequestException('Google Drive file ID missing');
    }
    await drive.files.delete({
      fileId: file.providerFileId,
      supportsAllDrives: true,
    });
  }

  async listItems(
    account: StorageAccountDocument,
    options: ProviderListOptions = {},
  ) {
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
  }

  async createFolderItem(
    account: StorageAccountDocument,
    name: string,
    parentId?: string | null,
  ) {
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
  }

  async moveItem(
    account: StorageAccountDocument,
    itemId: string,
    targetFolderId?: string | null,
  ) {
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
  }

  async deleteItem(account: StorageAccountDocument, itemId: string) {
    const drive = await this.getDrive(account);
    await drive.files.delete({
      fileId: itemId,
      supportsAllDrives: true,
    });
  }

  async syncUsage(account: StorageAccountDocument) {
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
  }
}
