# CloudNest AI Agent Integration Prompt

You are an AI coding agent integrating CloudNest into a user's project. CloudNest is a multi-provider storage gateway with a React dashboard, an Express/Postgres backend, and the official npm SDK package `@cloudnest/sdk`.

## Public Service

- Website: `https://cloudnest.urmate.tech`
- SDK docs: `https://cloudnest.urmate.tech/sdk`
- AI prompt page: `https://cloudnest.urmate.tech/ai-prompt`
- Agent text: `https://cloudnest.urmate.tech/llms.txt`
- Public API base for API-key uploads: `https://cloudnest.urmate.tech/api/v1`

## Core Rules

- Use only the official package: `@cloudnest/sdk`.
- Never hardcode API keys in source code.
- Never commit API keys, OAuth tokens, Telegram sessions, or provider secrets.
- Read API keys from environment variables, usually `CLOUDNEST_API_KEY`.
- Supported providers are `S3`, `GOOGLE_DRIVE`, and `TELEGRAM`.
- Providers can be disabled by admins. Do not assume S3 is enabled.
- If the user wants Google Drive, pass `provider: "GOOGLE_DRIVE"`.
- If the user gives a storage account or Drive folder, pass `storageAccountId` or `providerFolderId`.

## Install

```bash
npm install @cloudnest/sdk
```

## Node.js Upload

```ts
import { CloudNestClient } from "@cloudnest/sdk";

const cloudnest = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: process.env.CLOUDNEST_API_KEY!,
});

const result = await cloudnest.uploadFiles("./invoice.pdf", {
  provider: "GOOGLE_DRIVE",
});

console.log(result.data);
```

## File Management

```ts
const files = await cloudnest.listFiles({
  provider: "GOOGLE_DRIVE",
});

const file = await cloudnest.getFile("file-id");
const preview = await cloudnest.getPreviewUrl("file-id");
const playable = await cloudnest.getPlayableUrl("file-id");
const download = await cloudnest.getDownloadUrl("file-id");

await cloudnest.downloadFile("file-id", {
  destinationPath: "./downloaded-file.bin",
});

await cloudnest.deleteFile("file-id");
await cloudnest.deleteFiles(["file-id-1", "file-id-2"]);
```

For video and MP3/audio playback, call `getPlayableUrl(fileId)`. If `canPlay` is true, use `playUrl` as the `src` for a `<video controls>` or `<audio controls>` element.

## Backend Proxy Pattern

Use this pattern when integrating CloudNest into a web app. Keep the API key server-side.

```ts
import { CloudNestClient } from "@cloudnest/sdk";

const cloudnest = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: process.env.CLOUDNEST_API_KEY!,
});

export async function uploadToCloudNest(filePath: string) {
  return cloudnest.uploadFiles(filePath, {
    provider: "GOOGLE_DRIVE",
  });
}
```

## Direct REST Fallback

```ts
const formData = new FormData();
formData.append("files", file);
formData.append("provider", "GOOGLE_DRIVE");

const response = await fetch("https://cloudnest.urmate.tech/api/v1/files/upload", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + process.env.CLOUDNEST_API_KEY,
  },
  body: formData,
});

if (!response.ok) {
  throw new Error("CloudNest upload failed: " + response.status);
}

const result = await response.json();
```

## Upload Options

```ts
{
  provider?: "S3" | "GOOGLE_DRIVE" | "TELEGRAM";
  storageAccountId?: string;
  providerFolderId?: string;
}
```

## Response Shape

```ts
{
  message: string;
  data: Array<{
    fileId: string;
    originalName: string;
    size: number;
    ext: string;
    mimeType: string;
    provider?: "S3" | "GOOGLE_DRIVE" | "TELEGRAM";
    storageAccountId?: string | null;
    storageAccountName?: string | null;
    folderId?: string | null;
    folderName?: string | null;
  }>;
  failedCount?: number;
}
```

## Agent Checklist

1. Ask which provider to use if unclear.
2. Install `@cloudnest/sdk`.
3. Store the API key in an environment variable.
4. Use `apiUrl: "https://cloudnest.urmate.tech/api/v1"`.
5. Use `provider: "GOOGLE_DRIVE"` when S3 is disabled or Google Drive is desired.
6. Use `getPreviewUrl`, `getPlayableUrl`, `getDownloadUrl`, `downloadFile`, `deleteFile`, and `deleteFiles` for API-key file management.
7. Handle invalid API key, provider disabled, account not connected, file type not allowed, quota exceeded, and file not found.
8. Never expose secrets in code, commits, logs, screenshots, or browser bundles.

## Safety Note

CloudNest demonstrates multi-provider storage and admin workflows. Review security, provider policies, rate limits, secrets management, and privacy requirements before using it for sensitive production workloads.
