import { Readable } from 'stream';
import { FileDocument } from '../models/file.model';
import { StorageAccountDocument } from '../models/storage-account.model';

export interface ProviderUploadResult {
  storageKey: string;
  providerFileId: string;
  metadata: Record<string, unknown>;
}

export interface ProviderUploadOptions {
  folderPath?: string[];
  providerFolderId?: string | null;
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
    file: Express.Multer.File,
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
