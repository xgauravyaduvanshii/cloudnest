import { UnauthorizedError } from "./errors";
import {
  CloudNestClientOptions,
  DeleteFilesResponse,
  DownloadFileOptions,
  DownloadFileResult,
  DownloadFilesResponse,
  FilePreviewResponse,
  FileResponse,
  ListFilesOptions,
  ListFilesResponse,
  UploadFilesOptions,
  UploadInput,
  UploadResponseType,
} from "./types";
import { uploadFiles } from "./uploadFile";
import {
  deleteFiles,
  downloadFile,
  getDownloadUrl,
  getFile,
  getFilePreview,
  getPlayableMedia,
  listFiles,
} from "./file-api";

const DEFAULT_API_URL = "https://cloudnest.urmate.tech/api/v1";

export class CloudNestClient {
  private apiKey: string;
  private isBrowser: boolean;
  private apiUrl: string;

  constructor(options: CloudNestClientOptions) {
    if (!options.apiKey) throw new UnauthorizedError("API Key is required");
    this.apiKey = options.apiKey;
    this.isBrowser = options.isBrowser || false;
    this.apiUrl = options.apiUrl || DEFAULT_API_URL;
  }

  async uploadFiles(
    files: UploadInput | UploadInput[],
    uploadOptions: UploadFilesOptions = {}
  ): Promise<UploadResponseType> {
    return uploadFiles(files, {
      apiKey: this.apiKey,
      apiUrl: this.apiUrl,
      isBrowser: this.isBrowser,
      ...uploadOptions,
    });
  }

  async listFiles(options: ListFilesOptions = {}): Promise<ListFilesResponse> {
    return listFiles(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      options
    );
  }

  async getFile(fileId: string): Promise<FileResponse> {
    return getFile(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileId
    );
  }

  async getPreviewUrl(fileId: string): Promise<FilePreviewResponse> {
    return getFilePreview(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileId
    );
  }

  async getPlayableUrl(fileId: string): Promise<FilePreviewResponse> {
    return getPlayableMedia(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileId
    );
  }

  async getDownloadUrl(
    fileIds: string | string[]
  ): Promise<DownloadFilesResponse> {
    return getDownloadUrl(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileIds
    );
  }

  async downloadFile(
    fileId: string,
    options: DownloadFileOptions = {}
  ): Promise<DownloadFileResult> {
    return downloadFile(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileId,
      options
    );
  }

  async deleteFile(fileId: string): Promise<DeleteFilesResponse> {
    return deleteFiles(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileId
    );
  }

  async deleteFiles(fileIds: string[]): Promise<DeleteFilesResponse> {
    return deleteFiles(
      {
        apiKey: this.apiKey,
        apiUrl: this.apiUrl,
      },
      fileIds
    );
  }
}
