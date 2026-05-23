export interface Params {
  keyword?: string;
  folderId?: string | null;
  provider?: StorageProvider;
  storageAccountId?: string | null;
  pageNumber?: number;
  pageSize?: number;
}

export type StorageProvider = "S3" | "GOOGLE_DRIVE" | "TELEGRAM";

export interface UploadResponse {
  message: string;
  data: {
    fileId: string;
    url: string;
    originalName: string;
    size: number;
    ext: string;
    mimeType: string;
    folderId?: string | null;
    folderName?: string | null;
  }[];
  failedCount: number;
}

export interface FolderType {
  _id: string;
  id: string;
  userId: string;
  parentId: string | null;
  provider: StorageProvider;
  name: string;
  providerMetadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isExternal?: boolean;
}

export interface FileType {
  _id: string;
  userId: string;
  originalName: string;
  size: number;
  formattedSize: string;
  ext: string;
  mimeType: string;
  provider?: StorageProvider;
  storageAccountId?: string | null;
  storageAccountName?: string | null;
  folderId?: string | null;
  folderName?: string | null;
  url: string;
  webViewLink?: string | null;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  id?: string;
  uploadedVia: "WEB" | "API";
  uploadVia?: "WEB" | "API";
  isExternal?: boolean;
}
export interface GetAllFilesResponse {
  message: string;
  folders: FolderType[];
  breadcrumbs: FolderType[];
  files: FileType[];
  pagination: {
    pageSize: number;
    pageNumber: number;
    totalCount: number;
    totalPages: number;
    skip: number;
  };
}

export interface CreateFolderResponse {
  message: string;
  folder: FolderType;
}
export interface MoveFilesResponse {
  message: string;
  movedCount: number;
}
export interface MoveFolderResponse {
  message: string;
  folder: FolderType;
}
export interface DeleteFilesResponse {
  message: string;
  deletedCount: number;
  failedCount: number;
}

export interface DownloadFilesResponse {
  message: string;
  downloadUrl: string;
  isZip: boolean;
}
