import { UnauthorizedError } from "./errors";
import {
  CloudNestClientOptions,
  UploadFilesOptions,
  UploadInput,
  UploadResponseType,
} from "./types";
import { uploadFiles } from "./uploadFile";

const DEFAULT_API_URL = "https://cloudnest.onrender.com/api/v1";

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
}
