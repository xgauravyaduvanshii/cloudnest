import type { UploadRequestOptions } from "../types";

export async function request(
  url: string,
  options: UploadRequestOptions
): Promise<Response> {
  return fetch(url, {
    method: options.method,
    headers: {
      ...options.headers,
    },
    body: options.body as FormData, // Browser's native FormData
  });
}
