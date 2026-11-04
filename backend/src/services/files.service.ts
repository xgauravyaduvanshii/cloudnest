import path from 'path';
import { PassThrough } from 'stream';
import jwt from 'jsonwebtoken';
import archiver from 'archiver';
import FileModel, { FileDocument, UploadSourceEnum } from '../models/file.model';
import FolderModel, { FolderDocument } from '../models/folder.model';
import UserModel from '../models/user.model';
import ActivityModel from '../models/activity.model';
import ShareModel from '../models/share.model';
import StorageAccountModel, {
  StorageProviderType,
} from '../models/storage-account.model';
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '../utils/app-error';
import { sanitizeFilename } from '../utils/helper';
import { formatBytes } from '../utils/format-byte';
import { logger } from '../utils/logger';
import { Env } from '../config/env.config';
import { withTransaction } from '../config/database.config';
import { getStorageProvider } from '../providers';
import {
  chooseStorageAccountForUpload,
  ensureDefaultS3StorageAccount,
} from './storage-accounts.service';

type DownloadTokenPayload = {
  userId?: string;
  fileIds: string[];
  admin?: boolean;
};

type GoogleDrivePreviewTokenPayload = {
  userId: string;
  accountId: string;
  itemId: string;
};

const toPublicFolder = (folder: FolderDocument) => ({
  _id: folder.id,
  id: folder.id,
  userId: folder.userId,
  parentId: folder.parentId,
  provider: folder.provider,
  name: folder.name,
  providerMetadata: folder.providerMetadata,
  createdAt: folder.createdAt,
  updatedAt: folder.updatedAt,
});

export const getPublicFileUrl = (fileId: string) =>
  `${Env.API_PUBLIC_URL}/files/${fileId}/view`;

const getGoogleDrivePreviewUrl = (
  userId: string,
  accountId: string,
  itemId: string,
) => {
  const token = jwt.sign(
    {
      userId,
      accountId,
      itemId,
    } satisfies GoogleDrivePreviewTokenPayload,
    Env.JWT_SECRET,
    {
      expiresIn: '1h',
      audience: ['google-drive-live-preview'],
    },
  );

  return `${Env.API_PUBLIC_URL}/files/google-drive/${accountId}/${itemId}/view?token=${encodeURIComponent(token)}`;
};

const getFileStorageAccount = async (file: FileDocument) => {
  if (!file.storageAccountId) {
    return ensureDefaultS3StorageAccount();
  }

  const account = await StorageAccountModel.findById(file.storageAccountId);
  if (!account) throw new NotFoundException('Storage account not found');
  if (account.status === 'ACTIVE') return account;

  const replacement = await StorageAccountModel.findActiveReplacementForAccount(
    account,
  );
  if (replacement) {
    logger.warn('Using active replacement storage account for file read', {
      fileId: file.id,
      provider: file.provider,
      storageAccountId: account.id,
      replacementStorageAccountId: replacement.id,
    });
    return replacement;
  }

  return account;
};

const getMediaType = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('text/')) return 'text';
  return 'file';
};

export const toPublicFile = (file: FileDocument) => {
  const { storageKey, providerFileId, providerMetadata, ...publicFile } = file;
  return {
    ...publicFile,
    url: getPublicFileUrl(file._id),
    previewUrl: getPublicFileUrl(file._id),
    downloadUrl: getPublicFileUrl(file._id),
    mediaType: getMediaType(file.mimeType),
    canPreviewInline:
      file.mimeType.startsWith('image/') ||
      file.mimeType.startsWith('video/') ||
      file.mimeType.startsWith('audio/') ||
      file.mimeType === 'application/pdf' ||
      file.mimeType.startsWith('text/'),
    canPlay:
      file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/'),
  };
};

const assertFolderAccess = async (
  userId: string,
  provider: StorageProviderType,
  folderId?: string | null,
) => {
  if (!folderId) return null;
  const folder = await FolderModel.findByIdForUser(folderId, userId, provider);
  if (!folder) throw new NotFoundException('Folder not found');
  return folder;
};

const normalizeRelativePaths = (input?: string | string[]) => {
  if (!input) return [];
  return Array.isArray(input) ? input : [input];
};

const getRelativeFolderParts = (relativePath: string | undefined) => {
  if (!relativePath) return [];
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && part !== '.' && part !== '..');
  return parts.length > 1 ? parts.slice(0, -1) : [];
};

const getFolderPathNames = async (
  userId: string,
  provider: StorageProviderType,
  folderId: string | null,
) => {
  if (!folderId) return [];
  const folders = await FolderModel.findPath(userId, folderId, provider);
  return folders.map((folder) => folder.name);
};

export const uploadFilesService = async (
  userId: string | undefined,
  files: Express.Multer.File[],
  uploadedVia: keyof typeof UploadSourceEnum,
  options: {
    folderId?: string | null;
    provider?: StorageProviderType;
    relativePaths?: string | string[];
    storageAccountId?: string | null;
    providerFolderId?: string | null;
  } = {},
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const user = await UserModel.findById(userId);
  if (!user) throw new UnauthorizedException('Unauthorized access');
  if (!files?.length) throw new BadRequestException('No files provided');
  const providerType = options.provider || 'S3';
  if (options.folderId) {
    await assertFolderAccess(userId, providerType, options.folderId);
  }

  const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
  const account = await chooseStorageAccountForUpload(
    userId,
    totalFileSize,
    providerType,
    options.storageAccountId,
  );
  const provider = getStorageProvider(account.provider);
  const providerFolderId =
    options.storageAccountId && account.id !== options.storageAccountId
      ? null
      : options.providerFolderId || null;
  const relativePaths = normalizeRelativePaths(options.relativePaths);
  const folderIdsByIndex: (string | null)[] = [];
  const folderPathsByIndex: string[][] = [];

  for (const [index, file] of files.entries()) {
    const relativePath = relativePaths[index] || file.originalname;
    const relativeFolderParts = getRelativeFolderParts(relativePath);
    if (providerFolderId) {
      folderIdsByIndex[index] = null;
      folderPathsByIndex[index] = relativeFolderParts;
      continue;
    }

    folderIdsByIndex[index] = relativeFolderParts.length
      ? await FolderModel.ensurePath(
          userId,
          options.folderId || null,
          providerType,
          relativeFolderParts,
        )
      : providerFolderId
        ? null
        : options.folderId || null;
    folderPathsByIndex[index] = await getFolderPathNames(
      userId,
      providerType,
      folderIdsByIndex[index],
    );
  }

  const results = await Promise.allSettled(
    files.map(async (file, index) => {
      let providerResult:
        | {
            storageKey: string;
            providerFileId: string;
            metadata: Record<string, unknown>;
          }
        | null = null;

      try {
        providerResult = await provider.upload(account, userId, file, {
          folderPath: folderPathsByIndex[index],
          providerFolderId,
        });
        const createdFile = await FileModel.create({
          userId,
          storageAccountId: account.id,
          folderId: folderIdsByIndex[index],
          provider: account.provider,
          storageKey: providerResult.storageKey,
          providerFileId: providerResult.providerFileId,
          providerMetadata: providerResult.metadata,
          originalName: file.originalname,
          uploadVia: uploadedVia,
          size: file.size,
          ext: path.extname(file.originalname)?.slice(1)?.toLowerCase(),
          url: '',
          mimeType: file.mimetype,
        });

        return {
          fileId: createdFile._id,
          url: getPublicFileUrl(createdFile._id),
          originalName: createdFile.originalName,
          size: createdFile.size,
          ext: createdFile.ext,
          mimeType: createdFile.mimeType,
          provider: createdFile.provider,
          storageAccountId: createdFile.storageAccountId,
          storageAccountName: account.displayName,
          folderId: createdFile.folderId,
          folderName: createdFile.folderName,
        };
      } catch (error) {
        logger.error('Error uploading file', error);
        if (providerResult) {
          await provider
            .delete(account, {
              _id: '',
              id: '',
              userId,
              originalName: file.originalname,
              storageKey: providerResult.storageKey,
              provider: account.provider,
              storageAccountId: account.id,
              storageAccountName: account.displayName,
              folderId: folderIdsByIndex[index],
              folderName: null,
              providerFileId: providerResult.providerFileId,
              providerMetadata: providerResult.metadata,
              mimeType: file.mimetype,
              size: file.size,
              formattedSize: '',
              ext: path.extname(file.originalname)?.slice(1)?.toLowerCase(),
              uploadVia: uploadedVia,
              url: '',
              checksumSha256: null,
              originalPath: null,
              providerFolderId: null,
              versionGroupId: null,
              supersedesFileId: null,
              versionNumber: 1,
              isLatest: true,
              uploadJobItemId: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            .catch((rollbackError) =>
              logger.error('Failed to roll back provider upload', rollbackError),
            );
        }
        throw error;
      }
    }),
  );

  await provider
    .syncUsage(account)
    .then((usage) =>
      StorageAccountModel.updateUsage(account.id, {
        usageBytes: usage.usageBytes,
        limitBytes: usage.limitBytes,
        usageDetails: usage.details,
        status: 'ACTIVE',
        errorMessage: null,
      }),
    )
    .catch((error) =>
      logger.warn(`Failed to refresh usage for ${account.id}`, error),
    );

  const successfulRes = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);

  const failedRes = results
    .filter((r) => r.status === 'rejected')
    .map((r) => r.reason.message);

  if (failedRes.length > 0) {
    logger.warn('Failed to upload files', files);
  }

  if (successfulRes.length > 0) {
    ActivityModel.record({
      userId,
      action: 'file.upload',
      entityType: 'file',
      entityId: successfulRes[0].fileId,
      actorType: uploadedVia === 'API' ? 'api' : 'user',
      metadata: {
        count: successfulRes.length,
        provider: account.provider,
        storageAccountId: account.id,
      },
    }).catch(() => undefined);
  }

  return {
    message: `Uploaded successfully ${successfulRes.length} out of ${files.length} files`,
    data: successfulRes,
    failedCount: failedRes.length,
  };
};

export const getAllFilesService = async (
  userId: string | undefined,
  filter: {
    keyword?: string;
    folderId?: string | null;
    provider?: StorageProviderType;
  },
  pagination: { pageSize: number; pageNumber: number },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { keyword, folderId } = filter;
  const provider = filter.provider || 'S3';
  await assertFolderAccess(userId, provider, folderId);
  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [files, folders, breadcrumbs, totalCount] = await Promise.all([
    FileModel.findAllByUser(userId, keyword, {
      limit: pageSize,
      offset: skip,
    }, folderId || null, provider),
    FolderModel.findChildren(userId, folderId || null, provider, keyword),
    FolderModel.findPath(userId, folderId || null, provider),
    FileModel.countByUser(userId, keyword, folderId || null, provider),
  ]);

  const filesWithUrls = files.map((file) => {
    return toPublicFile(file);
  });

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    folders: folders.map(toPublicFolder),
    breadcrumbs: breadcrumbs.map(toPublicFolder),
    files: filesWithUrls,
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip,
    },
  };
};

export const getFilesForApiKeyService = async (
  userId: string | undefined,
  filter: {
    keyword?: string;
    folderId?: string | null;
    provider?: StorageProviderType;
  },
  pagination: { pageSize: number; pageNumber: number },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const { keyword, folderId, provider } = filter;
  if (folderId && !provider) {
    throw new BadRequestException('Provider is required when filtering by folder');
  }
  if (provider) await assertFolderAccess(userId, provider, folderId);

  const { pageSize, pageNumber } = pagination;
  const skip = (pageNumber - 1) * pageSize;

  const [files, totalCount] = await Promise.all([
    FileModel.findAllByUser(userId, keyword, {
      limit: pageSize,
      offset: skip,
    }, folderId || null, provider),
    FileModel.countByUser(userId, keyword, folderId || null, provider),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    files: files.map(toPublicFile),
    pagination: {
      pageSize,
      pageNumber,
      totalCount,
      totalPages,
      skip,
    },
  };
};

export const getFileDetailsService = async (
  userId: string | undefined,
  fileId: string,
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const files = await FileModel.findByIdsForUser([fileId], userId);
  const file = files[0];
  if (!file) throw new NotFoundException('File not found');

  return toPublicFile(file);
};

export const getFilePreviewService = async (
  userId: string | undefined,
  fileId: string,
) => {
  const file = await getFileDetailsService(userId, fileId);

  return {
    file,
    previewUrl: file.previewUrl,
    playUrl: file.canPlay ? file.previewUrl : null,
    downloadUrl: file.downloadUrl,
    mediaType: file.mediaType,
    mimeType: file.mimeType,
    canPreviewInline: file.canPreviewInline,
    canPlay: file.canPlay,
    suggestedElement: file.mimeType.startsWith('video/')
      ? 'video'
      : file.mimeType.startsWith('audio/')
        ? 'audio'
        : file.mimeType.startsWith('image/')
          ? 'img'
          : file.mimeType === 'application/pdf'
            ? 'iframe'
            : 'a',
  };
};

export const createFolderService = async (
  userId: string | undefined,
  input: {
    name: string;
    parentId?: string | null;
    provider?: StorageProviderType;
  },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const providerType = input.provider || 'S3';
  await assertFolderAccess(userId, providerType, input.parentId);
  const providerAccount =
    providerType === 'GOOGLE_DRIVE'
      ? await chooseStorageAccountForUpload(userId, 0, providerType)
      : null;
  const folder = await FolderModel.create({
    userId,
    parentId: input.parentId || null,
    provider: providerType,
    name: input.name,
  });
  if (providerType === 'GOOGLE_DRIVE') {
    const provider = getStorageProvider(providerType);
    const folderPath = await getFolderPathNames(userId, providerType, folder.id);
    if (provider.ensureFolder) {
      const metadata = await provider.ensureFolder(
        providerAccount!,
        userId,
        folderPath,
      );
      const updated = await FolderModel.updateProviderMetadata(
        folder.id,
        providerAccount!.id,
        metadata,
      );
      return toPublicFolder(updated || folder);
    }
  }
  return toPublicFolder(folder);
};

const assertStorageAccountForUser = async (
  accountId: string,
  user: Express.User,
  provider: StorageProviderType,
) => {
  const account = await StorageAccountModel.findById(accountId);
  if (!account) throw new NotFoundException('Storage account not found');
  if (account.provider !== provider) {
    throw new BadRequestException('Storage account provider mismatch');
  }
  if (account.status !== 'ACTIVE') {
    throw new BadRequestException('Storage account is not active');
  }
  if (account.ownerType !== 'ADMIN' && account.userId !== user._id) {
    throw new UnauthorizedException('Storage account access denied');
  }
  return account;
};

const getExtensionFromName = (name: string) => {
  const ext = path.extname(name)?.slice(1)?.toLowerCase();
  return ext || 'file';
};

const toGoogleDriveFolder = (item: any, userId: string, accountId: string) => ({
  _id: item.id,
  id: item.id,
  userId,
  parentId: item.parents?.[0] || null,
  provider: 'GOOGLE_DRIVE' as StorageProviderType,
  name: item.name,
  providerMetadata: {
    source: 'google_drive_live',
    accountId,
    driveFileId: item.id,
    webViewLink: item.webViewLink || null,
  },
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
  isExternal: true,
});

const toGoogleDriveFile = (
  item: any,
  userId: string,
  accountId: string,
  accountName: string,
) => {
  const previewUrl = getGoogleDrivePreviewUrl(userId, accountId, item.id);

  return {
    _id: item.id,
    id: item.id,
    userId,
    originalName: item.name,
    size: item.size || 0,
    formattedSize: formatBytes(item.size || 0),
    ext: getExtensionFromName(item.name),
    mimeType: item.mimeType,
    provider: 'GOOGLE_DRIVE' as StorageProviderType,
    storageAccountId: accountId,
    storageAccountName: accountName,
    folderId: item.parents?.[0] || null,
    folderName: null,
    url: previewUrl,
    webViewLink: item.webViewLink || null,
    thumbnailUrl: item.thumbnailLink || previewUrl,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
    uploadedVia: 'WEB',
    uploadVia: 'WEB',
    isExternal: true,
  };
};

export const listGoogleDriveItemsService = async (
  user: Express.User,
  input: {
    accountId: string;
    folderId?: string | null;
    keyword?: string;
    pageSize?: number;
    pageToken?: string;
  },
) => {
  const account = await assertStorageAccountForUser(
    input.accountId,
    user,
    'GOOGLE_DRIVE',
  );
  const provider = getStorageProvider('GOOGLE_DRIVE');
  if (!provider.listItems) {
    throw new BadRequestException('Google Drive browsing is not available');
  }
  const result = await provider.listItems(account, {
    folderId: input.folderId,
    keyword: input.keyword,
    pageSize: input.pageSize,
    pageToken: input.pageToken,
  });

  return {
    folders: result.folders.map((item) =>
      toGoogleDriveFolder(item, user._id, account.id),
    ),
    files: result.files.map((item) =>
      toGoogleDriveFile(item, user._id, account.id, account.displayName),
    ),
    pagination: {
      pageSize: input.pageSize || 100,
      pageNumber: 1,
      totalCount: result.folders.length + result.files.length,
      totalPages: result.nextPageToken ? 2 : 1,
      skip: 0,
      nextPageToken: result.nextPageToken || null,
    },
  };
};

export const createGoogleDriveFolderService = async (
  user: Express.User,
  input: {
    accountId: string;
    name: string;
    parentId?: string | null;
  },
) => {
  const account = await assertStorageAccountForUser(
    input.accountId,
    user,
    'GOOGLE_DRIVE',
  );
  const provider = getStorageProvider('GOOGLE_DRIVE');
  if (!provider.createFolderItem) {
    throw new BadRequestException('Google Drive folder creation is not available');
  }
  const item = await provider.createFolderItem(
    account,
    input.name,
    input.parentId || null,
  );
  return toGoogleDriveFolder(item, user._id, account.id);
};

export const deleteGoogleDriveItemService = async (
  user: Express.User,
  accountId: string,
  itemId: string,
) => {
  const account = await assertStorageAccountForUser(
    accountId,
    user,
    'GOOGLE_DRIVE',
  );
  const provider = getStorageProvider('GOOGLE_DRIVE');
  if (!provider.deleteItem) {
    throw new BadRequestException('Google Drive delete is not available');
  }
  await provider.deleteItem(account, itemId);
  return { deletedCount: 1 };
};

export const moveGoogleDriveItemService = async (
  user: Express.User,
  input: {
    accountId: string;
    itemId: string;
    targetFolderId?: string | null;
  },
) => {
  const account = await assertStorageAccountForUser(
    input.accountId,
    user,
    'GOOGLE_DRIVE',
  );
  const provider = getStorageProvider('GOOGLE_DRIVE');
  if (!provider.moveItem) {
    throw new BadRequestException('Google Drive move is not available');
  }
  const item = await provider.moveItem(
    account,
    input.itemId,
    input.targetFolderId || null,
  );
  return item.isFolder
    ? toGoogleDriveFolder(item, user._id, account.id)
    : toGoogleDriveFile(item, user._id, account.id, account.displayName);
};

export const moveFilesService = async (
  userId: string | undefined,
  input: {
    fileIds: string[];
    targetFolderId?: string | null;
    provider?: StorageProviderType;
  },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const provider = input.provider || 'S3';
  if (input.targetFolderId) {
    await assertFolderAccess(userId, provider, input.targetFolderId);
  }
  const movedCount = await FileModel.moveByIdsForUser(
    input.fileIds,
    userId,
    provider,
    input.targetFolderId || null,
  );
  return { movedCount };
};

export const moveFolderService = async (
  userId: string | undefined,
  folderId: string,
  input: {
    targetFolderId?: string | null;
    provider?: StorageProviderType;
  },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const provider = input.provider || 'S3';
  await assertFolderAccess(userId, provider, folderId);
  if (input.targetFolderId) {
    await assertFolderAccess(userId, provider, input.targetFolderId);
  }
  const folder = await FolderModel.moveByIdForUser(
    folderId,
    userId,
    provider,
    input.targetFolderId || null,
  );
  if (!folder) throw new NotFoundException('Folder not found');
  return toPublicFolder(folder);
};

export const deleteFolderService = async (
  userId: string | undefined,
  folderId: string,
  provider: StorageProviderType = 'S3',
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  await assertFolderAccess(userId, provider, folderId);
  const hasChildren = await FolderModel.hasChildren(userId, folderId, provider);
  if (hasChildren) {
    throw new BadRequestException('Folder must be empty before deleting');
  }
  const deletedCount = await FolderModel.deleteByIdForUser(
    folderId,
    userId,
    provider,
  );
  return { deletedCount };
};

export const getFileUrlService = async (fileId: string) => {
  const file = await FileModel.findById(fileId);
  if (!file) throw new NotFoundException('File not found');

  const account = await getFileStorageAccount(file);
  const provider = getStorageProvider(account.provider);

  const result = await provider.getReadStream(account, file);

  return {
    url: '',
    stream: result.stream,
    contentType: result.contentType,
    fileSize: result.fileSize,
  };
};

export const getGoogleDriveItemPreviewStreamService = async (
  accountId: string,
  itemId: string,
  token?: string,
) => {
  if (!token) throw new UnauthorizedException('Preview token is required');

  let decoded: GoogleDrivePreviewTokenPayload;
  try {
    decoded = jwt.verify(token, Env.JWT_SECRET, {
      audience: ['google-drive-live-preview'],
    }) as GoogleDrivePreviewTokenPayload;
  } catch {
    throw new UnauthorizedException('Invalid or expired preview token');
  }

  if (decoded.accountId !== accountId || decoded.itemId !== itemId) {
    throw new UnauthorizedException('Preview token does not match this file');
  }

  const account = await StorageAccountModel.findById(accountId);
  if (!account) throw new NotFoundException('Storage account not found');
  if (account.provider !== 'GOOGLE_DRIVE') {
    throw new BadRequestException('Storage account provider mismatch');
  }
  if (account.status !== 'ACTIVE') {
    throw new BadRequestException('Storage account is not active');
  }
  if (account.ownerType !== 'ADMIN' && account.userId !== decoded.userId) {
    throw new UnauthorizedException('Storage account access denied');
  }

  const provider = getStorageProvider('GOOGLE_DRIVE');
  if (!provider.getItemReadStream) {
    throw new BadRequestException('Google Drive preview is not available');
  }

  return provider.getItemReadStream(account, itemId);
};

export const deleteFilesService = async (
  userId: string | undefined,
  fileIds: string[],
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const files = await FileModel.findByIdsForUser(fileIds, userId);
  if (!files.length) throw new NotFoundException('No files found');

  const providerErrors: string[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const account = await getFileStorageAccount(file);
        const provider = getStorageProvider(account.provider);
        await provider.delete(account, file);
      } catch (error) {
        logger.error(`Failed to delete ${file._id} from provider`, error);
        providerErrors.push(file._id);
      }
    }),
  );

  const successfulFileIds = files
    .filter((file) => !providerErrors.includes(file._id))
    .map((file) => file._id);

  const deletedCount = await withTransaction((client) =>
    FileModel.deleteByIdsForUser(successfulFileIds, userId, client),
  );

  // Drop any file shares and record the deletion in the activity timeline.
  await ShareModel.deleteForResources('file', successfulFileIds).catch((error) =>
    logger.warn('Failed to clean shares for deleted files', error),
  );
  if (deletedCount > 0) {
    ActivityModel.record({
      userId,
      action: 'file.delete',
      entityType: 'file',
      entityId: successfulFileIds[0],
      metadata: { count: deletedCount },
    }).catch(() => undefined);
  }

  const touchedAccountIds = Array.from(
    new Set(files.map((file) => file.storageAccountId).filter(Boolean)),
  ) as string[];
  await Promise.all(
    touchedAccountIds.map(async (accountId) => {
      const account = await StorageAccountModel.findById(accountId);
      if (!account) return;
      const provider = getStorageProvider(account.provider);
      await provider
        .syncUsage(account)
        .then((usage) =>
          StorageAccountModel.updateUsage(account.id, {
            usageBytes: usage.usageBytes,
            limitBytes: usage.limitBytes,
            usageDetails: usage.details,
            status: 'ACTIVE',
            errorMessage: null,
          }),
        )
        .catch((error) => logger.warn('Failed to sync account after delete', error));
    }),
  );

  return {
    deletedCount,
    failedCount: providerErrors.length,
  };
};

export const downloadFilesService = async (
  userId: string | undefined,
  fileIds: string[],
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');

  const files = await FileModel.findByIdsForUser(fileIds, userId);
  if (!files.length) throw new NotFoundException('No files found');

  if (files.length === 1) {
    return {
      url: getPublicFileUrl(files[0]._id),
      isZip: false,
    };
  }

  const token = jwt.sign(
    {
      userId,
      fileIds,
    } satisfies DownloadTokenPayload,
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

export const createZipStreamFromTokenService = async (token: string) => {
  let decoded: DownloadTokenPayload;
  try {
    decoded = jwt.verify(token, Env.JWT_SECRET, {
      audience: ['file-download'],
    }) as DownloadTokenPayload;
  } catch {
    throw new UnauthorizedException('Invalid or expired download token');
  }

  const files = decoded.admin
    ? await FileModel.findByIds(decoded.fileIds)
    : decoded.userId
      ? await FileModel.findByIdsForUser(decoded.fileIds, decoded.userId)
      : [];
  if (!files.length) throw new NotFoundException('No files found');

  const zip = archiver('zip', { zlib: { level: 6 } });
  const passThrough = new PassThrough();
  zip.pipe(passThrough);

  process.nextTick(async () => {
    try {
      for (const file of files) {
        const account = await getFileStorageAccount(file);
        const provider = getStorageProvider(account.provider);
        const result = await provider.getReadStream(account, file);
        zip.append(result.stream, { name: sanitizeFilename(file.originalName) });
      }
      await zip.finalize();
    } catch (error: any) {
      zip.destroy(error);
    }
  });

  return {
    stream: passThrough,
    filename: `cloudnest-${Date.now()}.zip`,
  };
};
