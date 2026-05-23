import NodeFormData from "form-data";
import { ALLOWED_MIME_TYPES, AllowedMimeType } from "../constants/file-types";
import {
  InvalidFileError,
  NetworkError,
  UnauthorizedError,
  UploadError,
  CloudNestError,
  ValidationError,
} from "../errors";
import { CloudNestClientOptions, UploadInput } from "../types";
import { browserRequest, nodeRequest } from "../request";

interface UploadOptions extends CloudNestClientOptions {
  apiUrl: string;
  provider?: "S3" | "GOOGLE_DRIVE" | "TELEGRAM";
  storageAccountId?: string;
  providerFolderId?: string;
}

type BrowserFormData = FormData;

function validateFileType(mimeType: string) {
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
    throw new InvalidFileError(
      `File type '${mimeType}' is not allowed.
      Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}
      `
    );
  }
}

export async function uploadFiles(
  files: UploadInput | UploadInput[],
  options: UploadOptions
) {
  const shouldUseBrowser = options.isBrowser;

  let formData: BrowserFormData | NodeFormData;

  if (shouldUseBrowser) {
    formData = new FormData();
  } else {
    formData = new NodeFormData();
  }

  const fileArray = Array.isArray(files) ? files : [files];
  if (options.provider) {
    formData.append("provider", options.provider);
  }
  if (options.storageAccountId) {
    formData.append("storageAccountId", options.storageAccountId);
  }
  if (options.providerFolderId) {
    formData.append("providerFolderId", options.providerFolderId);
  }

  for (const file of fileArray) {
    if (typeof file === "string" && !shouldUseBrowser) {
      validateFileType(file);

      const { createReadStream } = await import("fs");
      const stream = createReadStream(file);
      (formData as NodeFormData).append("files", stream);
    } else if (
      Buffer.isBuffer(file) &&
      !shouldUseBrowser &&
      formData instanceof NodeFormData
    ) {
      const fileMetadata = file as any;
      if (fileMetadata.type) {
        validateFileType(fileMetadata.type);
      }

      formData.append("files", file, {
        filename: fileMetadata.name || "file.bin",
        contentType: fileMetadata.type || "application/octet-stream",
        knownLength: fileMetadata.size,
      });
    } else if (file instanceof Blob || file instanceof File) {
      if (file instanceof File) {
        validateFileType(file.type);
      }
      (formData as FormData).append("files", file);
    } else {
      if (shouldUseBrowser && typeof file === "string") {
        throw new InvalidFileError(
          "File paths are not supported when isBrowser is enabled. Use File objects instead."
        );
      } else if (shouldUseBrowser && file instanceof Buffer) {
        throw new InvalidFileError(
          "Buffers are not supported when isBrowser is enabled"
        );
      }
      //throw new InvalidFileError("Invalid File")
    }
  }

  try {
    const response = await (shouldUseBrowser ? browserRequest : nodeRequest)(
      `${options.apiUrl}/files/upload`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
        },
        body: formData,
      }
    );

    if (!response.ok) {
      switch (response.status) {
        case 400:
          throw new ValidationError("Invalid request format");
        case 401:
          throw new UnauthorizedError("Unathorized Access");
        case 413:
          throw new UploadError("File size too large");
        case 503:
          throw new NetworkError("Service temporarily unavailable");
        default:
          throw new UploadError(
            `Upload failed: ${response.status}
            ${response.statusText}`
          );
      }
    }

    return response.json();
  } catch (error) {
    if (error instanceof CloudNestError) {
      throw error;
    }
    throw new UploadError(
      error instanceof Error ? error.message : "Unknown error occurred"
    );
  }
}
