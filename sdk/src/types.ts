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
