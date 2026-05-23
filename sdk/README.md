# @cloudnest/sdk

[![NPM version](https://img.shields.io/npm/v/@cloudnest/sdk.svg)](https://npmjs.org/package/@cloudnest/sdk)
![Bundle Size](https://img.shields.io/bundlephobia/minzip/@cloudnest/sdk)

TypeScript library for uploading files to CloudNest API. Works in Node.js, Next.js, and browsers.

## Installation

```bash
npm install @cloudnest/sdk
# or
pnpm add @cloudnest/sdk
```

## Quick Start

```typescript
import { CloudNestClient } from "@cloudnest/sdk";

const client = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: "your-api-key",
});

// Upload files
const result = await client.uploadFiles(files);
console.log(result.data);
```

## File Management

All file management methods use the same API key.

```typescript
// List files owned by the API key user.
const files = await client.listFiles({
  provider: "GOOGLE_DRIVE",
  pageSize: 20,
});

// Get metadata for one file.
const file = await client.getFile("file-id");

// Get an inline preview URL for images, PDFs, text, video, and audio.
const preview = await client.getPreviewUrl("file-id");

// Audio/video helper. Use playUrl in <audio> or <video>.
const playable = await client.getPlayableUrl("file-id");

// Get a download URL without downloading bytes.
const download = await client.getDownloadUrl("file-id");

// Download bytes. In Node.js, pass destinationPath to save to disk.
await client.downloadFile("file-id", {
  destinationPath: "./downloaded-file.bin",
});

// Delete one or many files.
await client.deleteFile("file-id");
await client.deleteFiles(["file-id-1", "file-id-2"]);
```

### Preview, Video, And MP3 Playback

```typescript
const preview = await client.getPlayableUrl("file-id");

if (preview.canPlay && preview.suggestedElement === "video") {
  videoElement.src = preview.playUrl!;
  videoElement.controls = true;
}

if (preview.canPlay && preview.suggestedElement === "audio") {
  audioElement.src = preview.playUrl!;
  audioElement.controls = true;
}
```

### Provider Uploads

```typescript
await client.uploadFiles(files, {
  provider: "GOOGLE_DRIVE",
});

await client.uploadFiles(files, {
  provider: "GOOGLE_DRIVE",
  storageAccountId: "google-storage-account-id",
  providerFolderId: "google-drive-folder-id",
});
```

## Usage Examples

### Node.js - File Paths

```typescript
// Upload from file path
await client.uploadFiles("/path/to/file.jpg");

// Multiple files
await client.uploadFiles(["/path/to/file1.jpg", "/path/to/file2.pdf"]);
```

### Node.js - Buffers

```typescript
import fs from "fs";

const buffer = fs.readFileSync("image.jpg");
// Add metadata to buffer
buffer.name = "image.jpg";
buffer.type = "image/jpeg";

await client.uploadFiles(buffer);
```

### Browser/Next.js - File Objects

```typescript
// From file input
const fileInput = document.querySelector('input[type="file"]');
await client.uploadFiles(fileInput.files[0]);

// Multiple files
await client.uploadFiles(Array.from(fileInput.files));
```

### Next.js Server Actions

```typescript
// app/upload/page.tsx
import { CloudNestClient } from "@cloudnest/sdk";

async function uploadAction(formData: FormData) {
  "use server";

  const client = new CloudNestClient({
    apiKey: process.env.CLOUDNEST_API_KEY!,
    isBrowser: true,
  });

  const file = formData.get("file") as File;
  const result = await client.uploadFiles(file);

  return result;
}
```

## Supported File Types

- **Node.js**: File paths (strings), Buffers
- **Browser**: File objects, Blob objects
- **Next.js**: File objects, Blob objects (server actions/API routes)

## Error Handling

```typescript
import { ValidationError, UploadError } from "@cloudnest/sdk/errors";

try {
  await client.uploadFiles(files);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("Invalid file type:", error.message);
  } else if (error instanceof UploadError) {
    console.log("Upload failed:", error.message);
  }
}
```

## TypeScript Support

Full TypeScript support with type definitions:

```typescript
import type {
  CloudNestFile,
  FilePreviewResponse,
  UploadResponseType,
} from "@cloudnest/sdk/types";

const result: UploadResponseType = await client.uploadFiles(files);
```

## Requirements

- **Node.js**: 18+
- **TypeScript**: 4.5+ (optional)
- **Browsers**: Modern browsers with fetch support
- **Next.js**: 13+ (App Router recommended)

## License

CloudNest Educational Use License. This SDK is part of the CloudNest educational project and is not production-ready. See [LICENSE](./LICENSE).
