// Copy-ready integration prompt for coding agents. Reused by the /ai-prompt
// page and mirrored in the static /ai-prompt.md and /llms.txt files.
export const aiAgentPrompt = String.raw`# CloudNest AI Agent Integration Prompt

You are an AI coding agent integrating CloudNest into a user's project. CloudNest is a multi-provider storage gateway with a React dashboard, an Express/Postgres backend, and the official npm SDK package @cloudnest/sdk.

Primary hosted service:
- Website: https://cloudnest.urmate.tech
- SDK docs: https://cloudnest.urmate.tech/sdk
- AI prompt: https://cloudnest.urmate.tech/ai-prompt
- Agent text: https://cloudnest.urmate.tech/llms.txt
- Full reference: https://cloudnest.urmate.tech/llms-full.txt
- Markdown prompt: https://cloudnest.urmate.tech/ai-prompt.md
- Public API base for SDK/API-key uploads: https://cloudnest.urmate.tech/api/v1

Core concepts:
- Users create API keys inside CloudNest.
- API keys are secret. Never hardcode them in source code, screenshots, commits, logs, or client bundles.
- Read API keys from environment variables such as CLOUDNEST_API_KEY.
- Storage providers are S3, GOOGLE_DRIVE, and TELEGRAM.
- Providers can be turned on or off by an admin. Do not assume S3 is enabled. If the user tells you Google Drive is enabled, pass provider: "GOOGLE_DRIVE".
- Google Drive supports connected accounts, storage account selection, Drive folders, upload, preview, move, delete, and usage sync.
- Telegram uses user-session storage and app-managed soft quota.
- AWS S3 is an admin-shared provider when configured and enabled.

Use the official SDK package only:

\`\`\`bash
npm install @cloudnest/sdk
\`\`\`

Node.js upload example:

\`\`\`ts
import { CloudNestClient } from "@cloudnest/sdk";

const cloudnest = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: process.env.CLOUDNEST_API_KEY!,
});

const result = await cloudnest.uploadFiles("./invoice.pdf", {
  provider: "GOOGLE_DRIVE",
});

console.log(result.data);
\`\`\`

File management with API keys:

\`\`\`ts
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
\`\`\`

For video and MP3/audio playback, call getPlayableUrl(fileId). If canPlay is true, use playUrl as the src for a video controls or audio controls element.

Browser or React example:

\`\`\`ts
import { CloudNestClient } from "@cloudnest/sdk";

const cloudnest = new CloudNestClient({
  apiUrl: "https://cloudnest.urmate.tech/api/v1",
  apiKey: import.meta.env.VITE_CLOUDNEST_API_KEY,
  isBrowser: true,
});

await cloudnest.uploadFiles(fileInput.files![0], {
  provider: "GOOGLE_DRIVE",
});
\`\`\`

Important browser security rule:
- Do not expose privileged production API keys in public browser bundles.
- For real apps, prefer uploading through your own backend route that reads CLOUDNEST_API_KEY server-side.

Backend proxy upload example:

\`\`\`ts
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
\`\`\`

Direct REST fallback:

\`\`\`ts
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
\`\`\`

Optional upload fields:
- provider: "S3" | "GOOGLE_DRIVE" | "TELEGRAM"
- storageAccountId: connected storage account id when the user wants a specific account
- providerFolderId: provider-native folder id, especially Google Drive folder id

Expected upload response shape:

\`\`\`ts
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
\`\`\`

Implementation checklist for agents:
1. Ask the user which provider they want if it is not clear.
2. Install @cloudnest/sdk.
3. Store the API key in an environment variable, not in code.
4. Use apiUrl: "https://cloudnest.urmate.tech/api/v1".
5. Use provider: "GOOGLE_DRIVE" when S3 is disabled or when Google Drive is desired.
6. Use getPreviewUrl, getPlayableUrl, getDownloadUrl, downloadFile, deleteFile, and deleteFiles for API-key file management.
7. Handle upload errors and show clear messages for invalid API key, provider disabled, account not connected, file type not allowed, quota exceeded, and file not found.
8. Never print full API keys, OAuth tokens, Telegram sessions, or provider secrets.
9. Do not use package names like cloudnest-sdk. The official package is @cloudnest/sdk.

Minimal test command:

\`\`\`bash
CLOUDNEST_API_KEY="sk_live_xxx" node upload-test.mjs
\`\`\`

Educational/safety note:
CloudNest demonstrates multi-provider storage and admin workflows. Review security, provider policies, rate limits, secrets management, and privacy requirements before using it for sensitive production workloads.`;
