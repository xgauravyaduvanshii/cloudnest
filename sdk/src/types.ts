import NodeFormData from "form-data";

export type StorageProvider = "S3" | "GOOGLE_DRIVE" | "TELEGRAM";

export interface CloudNestClientOptions {
  apiKey: string;
  isBrowser?: boolean;
  apiUrl?: string;
}

export type UploadInput = File | Blob | Buffer | string;

export interface UploadFilesOptions {
  provider?: StorageProvider;
  storageAccountId?: string;
  providerFolderId?: string;
}

export type CloudNestMediaType =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "text"
  | "file";

export interface CloudNestFile {
  _id: string;
  id: string;
  userId: string;
  originalName: string;
  provider: StorageProvider;
  storageAccountId: string | null;
  storageAccountName?: string | null;
  folderId: string | null;
  folderName?: string | null;
  mimeType: string;
  size: number;
  formattedSize: string;
  ext: string;
  uploadVia: "WEB" | "API";
  url: string;
  previewUrl: string;
  downloadUrl: string;
  mediaType: CloudNestMediaType;
  canPreviewInline: boolean;
  canPlay: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListFilesOptions {
  provider?: StorageProvider;
  keyword?: string;
  folderId?: string | null;
  pageSize?: number;
  pageNumber?: number;
}

export interface ListFilesResponse {
  message: string;
  files: CloudNestFile[];
  pagination: {
    pageSize: number;
    pageNumber: number;
    totalCount: number;
    totalPages: number;
    skip: number;
  };
}

export interface FileResponse {
  message: string;
  file: CloudNestFile;
}

export interface FilePreviewResponse {
  message: string;
  file: CloudNestFile;
  previewUrl: string;
  playUrl: string | null;
  downloadUrl: string;
  mediaType: CloudNestMediaType;
  mimeType: string;
  canPreviewInline: boolean;
  canPlay: boolean;
  suggestedElement: "video" | "audio" | "img" | "iframe" | "a";
}

export interface DownloadFilesResponse {
  message: string;
  downloadUrl: string;
  isZip: boolean;
}

export interface DeleteFilesResponse {
  message: string;
  deletedCount: number;
  failedCount?: number;
}

export interface DownloadFileOptions {
  destinationPath?: string;
}

export interface DownloadFileResult {
  fileId: string;
  downloadUrl: string;
  contentType: string;
  filename: string;
  arrayBuffer?: ArrayBuffer;
  destinationPath?: string;
  bytesWritten?: number;
}

export interface UploadResponseType {
  message: string;
  data: {
    fileId: string;
    originalName: string;
    size: number;
    ext: string;
    mimeType: string;
    provider?: StorageProvider;
    storageAccountId?: string | null;
    storageAccountName?: string | null;
    folderId?: string | null;
    folderName?: string | null;
  }[];
  failedCount?: number;
}

export interface UploadRequestOptions {
  method: string;
  headers: Record<string, string>;
  body: FormData | NodeFormData;
}
