import { Readable } from 'stream';
import { FileDocument } from '../models/file.model';
import { StorageAccountDocument } from '../models/storage-account.model';

export interface ProviderUploadResult {
  storageKey: string;
  providerFileId: string;
  metadata: Record<string, unknown>;
}

/**
 * Upload source accepted by providers.
 * Supports an in-memory buffer (legacy multer memoryStorage) or a disk temp
 * file path (multer diskStorage) so large files can be streamed instead of
 * fully buffered. Express.Multer.File is assignable to this shape.
 */
export interface ProviderUploadFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer?: Buffer;
  path?: string;
}

export type ProviderUploadInput = Express.Multer.File | ProviderUploadFile;

export type ProviderUploadMode = 'FLAT' | 'PRESERVE_STRUCTURE';

export interface ProviderUploadOptions {
  folderPath?: string[];
  providerFolderId?: string | null;
  mode?: ProviderUploadMode;
}

export interface ProviderReadResult {
  stream: Readable;
  contentType: string;
  fileSize?: number;
}

export interface ProviderUsageResult {
  usageBytes: number;
  limitBytes: number | null;
  details: Record<string, unknown>;
}

export interface ProviderListOptions {
  folderId?: string | null;
  keyword?: string;
  pageSize?: number;
  pageToken?: string;
}

export interface ProviderItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  isFolder: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  webViewLink?: string | null;
  webContentLink?: string | null;
  thumbnailLink?: string | null;
  parents?: string[];
}

export interface ProviderListResult {
  folders: ProviderItem[];
  files: ProviderItem[];
  nextPageToken?: string | null;
}

export interface StorageProvider {
  upload(
    account: StorageAccountDocument,
    userId: string,
    file: ProviderUploadInput,
    options?: ProviderUploadOptions,
  ): Promise<ProviderUploadResult>;
  ensureFolder?(
    account: StorageAccountDocument,
    userId: string,
    folderPath: string[],
  ): Promise<Record<string, unknown>>;
  listItems?(
    account: StorageAccountDocument,
    options?: ProviderListOptions,
  ): Promise<ProviderListResult>;
  createFolderItem?(
    account: StorageAccountDocument,
    name: string,
    parentId?: string | null,
  ): Promise<ProviderItem>;
  moveItem?(
    account: StorageAccountDocument,
    itemId: string,
    targetFolderId?: string | null,
  ): Promise<ProviderItem>;
  deleteItem?(account: StorageAccountDocument, itemId: string): Promise<void>;
  getItemReadStream?(
    account: StorageAccountDocument,
    itemId: string,
  ): Promise<ProviderReadResult>;
  getReadStream(
    account: StorageAccountDocument,
    file: FileDocument,
  ): Promise<ProviderReadResult>;
  delete(account: StorageAccountDocument, file: FileDocument): Promise<void>;
  syncUsage(account: StorageAccountDocument): Promise<ProviderUsageResult>;
}
