import {
  DeleteFilesResponse,
  DownloadFileOptions,
  DownloadFileResult,
  DownloadFilesResponse,
  FilePreviewResponse,
  FileResponse,
  ListFilesOptions,
  ListFilesResponse,
} from "./types";
import {
  CloudNestError,
  NetworkError,
  UnauthorizedError,
  UploadError,
  ValidationError,
} from "./errors";

type ApiClientOptions = {
  apiKey: string;
  apiUrl: string;
};

const trimApiUrl = (apiUrl: string) => apiUrl.replace(/\/+$/, "");

const buildQuery = (params: Record<string, string | number | null | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

const getFilenameFromDisposition = (contentDisposition: string | null) => {
  if (!contentDisposition) return "cloudnest-download";
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "cloudnest-download";
};

async function readErrorMessage(response: Response) {
  try {
    const body = await response.json();
    return body?.message || body?.error || response.statusText;
  } catch {
    return response.statusText;
  }
}

async function requestJson<T>(
  options: ApiClientOptions,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${trimApiUrl(options.apiUrl)}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {}),
      },
    });

    if (!response.ok) {
      const message = await readErrorMessage(response);
      if (response.status === 400) throw new ValidationError(message);
      if (response.status === 401) throw new UnauthorizedError(message);
      throw new UploadError(message || `Request failed: ${response.status}`);
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof CloudNestError) throw error;
    throw new NetworkError(
      error instanceof Error ? error.message : "Network request failed"
    );
  }
}

export function listFiles(
  options: ApiClientOptions,
  listOptions: ListFilesOptions = {}
) {
  return requestJson<ListFilesResponse>(
    options,
    `/files${buildQuery({
      provider: listOptions.provider,
      keyword: listOptions.keyword,
      folderId: listOptions.folderId,
      pageSize: listOptions.pageSize,
      pageNumber: listOptions.pageNumber,
    })}`
  );
}

export function getFile(options: ApiClientOptions, fileId: string) {
  return requestJson<FileResponse>(
    options,
    `/files/${encodeURIComponent(fileId)}`
  );
}

export function getFilePreview(options: ApiClientOptions, fileId: string) {
  return requestJson<FilePreviewResponse>(
    options,
    `/files/${encodeURIComponent(fileId)}/preview`
  );
}

export const getPlayableMedia = getFilePreview;

export function getDownloadUrl(
  options: ApiClientOptions,
  fileIds: string | string[]
) {
  const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
  return requestJson<DownloadFilesResponse>(options, "/files/download", {
    method: "POST",
    body: JSON.stringify({ fileIds: ids }),
  });
}

export function deleteFiles(
  options: ApiClientOptions,
  fileIds: string | string[]
) {
  const ids = Array.isArray(fileIds) ? fileIds : [fileIds];
  if (ids.length === 1) {
    return requestJson<DeleteFilesResponse>(
      options,
      `/files/${encodeURIComponent(ids[0])}`,
      {
        method: "DELETE",
      }
    );
  }

  return requestJson<DeleteFilesResponse>(options, "/files/bulk-delete", {
    method: "DELETE",
    body: JSON.stringify({ fileIds: ids }),
  });
}

export async function downloadFile(
  options: ApiClientOptions,
  fileId: string,
  downloadOptions: DownloadFileOptions = {}
): Promise<DownloadFileResult> {
  const { downloadUrl } = await getDownloadUrl(options, fileId);
  const response = await fetch(downloadUrl);

  if (!response.ok) {
    throw new UploadError(`Download failed: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType =
    response.headers.get("content-type") || "application/octet-stream";
  const filename = getFilenameFromDisposition(
    response.headers.get("content-disposition")
  );

  if (downloadOptions.destinationPath) {
    const { writeFile } = await import("node:fs/promises");
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(downloadOptions.destinationPath, buffer);
    return {
      fileId,
      downloadUrl,
      contentType,
      filename,
      destinationPath: downloadOptions.destinationPath,
      bytesWritten: buffer.byteLength,
    };
  }

  return {
    fileId,
    downloadUrl,
    contentType,
    filename,
    arrayBuffer,
  };
}
