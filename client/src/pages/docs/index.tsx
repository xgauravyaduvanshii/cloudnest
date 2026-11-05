import { Link } from "react-router-dom";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import atomOneDark from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import atomOneLight from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-light";
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Seo } from "@/components/seo/seo";
import { SiteLayout } from "@/components/marketing/site-layout";
import { PROTECTED_ROUTES, PUBLIC_ROUTES } from "@/routes/common/routePath";
import { SITE_URL } from "@/lib/site";
import { useTheme } from "@/context/theme-provider";

SyntaxHighlighter.registerLanguage("javascript", js);

const Docs = () => {
  const { theme } = useTheme();
  const public_baseurl = `${import.meta.env.VITE_API_URL}`;
  const codeTheme = theme === "light" ? atomOneLight : atomOneDark;
  const backgroundColor = theme === "dark" ? "#161616" : "#fafafa";

  const toc = [
    { id: "installation", label: "Installation" },
    { id: "provider-uploads", label: "Provider uploads" },
    { id: "file-management", label: "File management" },
    { id: "quick-start", label: "Quick start" },
    { id: "node", label: "Node.js usage" },
    { id: "browser", label: "Browser / React" },
    { id: "nextjs", label: "Next.js server actions" },
    { id: "errors", label: "Error handling" },
    { id: "rest", label: "Direct REST API" },
  ];

  return (
    <>
      <Seo
        path={PUBLIC_ROUTES.DOCS}
        title="CloudNest Docs — API & SDK guide"
        description="Official CloudNest documentation: install the @cloudnest/sdk, create API keys, and upload, list, preview, download, and delete files across Google Drive, Telegram, and AWS S3."
        keywords={[
          "cloudnest docs",
          "cloudnest api",
          "@cloudnest/sdk",
          "file upload api documentation",
        ]}
        type="article"
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "TechArticle",
            headline: "CloudNest API & SDK Documentation",
            url: `${SITE_URL}/docs`,
            profiler: "TypeScript",
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Docs", item: `${SITE_URL}/docs` },
            ],
          },
        ]}
      />
      <SiteLayout
        eyebrow="Documentation"
        title="CloudNest API & SDK documentation"
        description="Install @cloudnest/sdk, create an API key, and upload, list, preview, download, and delete files across Google Drive, Telegram, and AWS S3."
      >
      <nav
        aria-label="On this page"
        className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-5"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
          On this page
        </p>
        <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {toc.map((t) => (
            <li key={t.id}>
              <a href={`#${t.id}`} className="text-white/65 transition hover:text-white">
                {t.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mx-auto px-1">
        <div className="mb-8">
          <h2 className="text-lg font-semibold">TypeScript/JavaScript SDK</h2>
          <p className="text-sm text-muted-foreground mb-6">
            TypeScript library for uploading files to CloudNest API. Works in
            Node.js, Next.js, and browsers. Remember to create your API key on
            your{" "}
            <Link
              to={PROTECTED_ROUTES.APIKEYS}
              className="text-primary underline"
            >
              API Keys page
            </Link>
            .
          </p>

          <Card id="installation" className="mb-5 scroll-mt-24">
            <CardHeader>
              <CardTitle>Installation</CardTitle>
              <CardDescription>
                Official npm package name: @cloudnest/sdk
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language=""
                  style={codeTheme}
                  customStyle={{
                    background: backgroundColor,
                  }}
                >
                  {"npm install @cloudnest/sdk\n# or\npnpm add @cloudnest/sdk"}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="provider-uploads" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Provider Uploads</CardTitle>
              <CardDescription>
                Choose AWS S3, Google Drive, or Telegram when a provider is enabled.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`await client.uploadFiles(files, {
  provider: "GOOGLE_DRIVE",
});

// Optional: upload into a specific connected Google Drive account and folder.
await client.uploadFiles(files, {
  provider: "GOOGLE_DRIVE",
  storageAccountId: "google-storage-account-id",
  providerFolderId: "google-drive-folder-id",
});`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="file-management" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>File Management</CardTitle>
              <CardDescription>
                List, preview, play, download, and delete files with the same API key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`const files = await client.listFiles({
  provider: "GOOGLE_DRIVE",
  pageSize: 20,
});

const file = await client.getFile("file-id");
const preview = await client.getPreviewUrl("file-id");
const playable = await client.getPlayableUrl("file-id");

// Use playable.playUrl in <video controls> or <audio controls>.
const download = await client.getDownloadUrl("file-id");
await client.downloadFile("file-id", {
  destinationPath: "./downloaded-file.bin",
});

await client.deleteFile("file-id");
await client.deleteFiles(["file-id-1", "file-id-2"]);`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="quick-start" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
              <CardDescription>
                Upload files with just a few lines of code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`import { CloudNestClient } from "@cloudnest/sdk";

const client = new CloudNestClient({
  apiKey: process.env.CLOUDNEST_API_KEY, // Your API key
});

// Upload files
const result = await client.uploadFiles(files);
console.log(result.data);`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="node" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Node.js Usage</CardTitle>
              <CardDescription>
                Upload from file paths or buffers in Node.js applications.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`import { CloudNestClient } from "@cloudnest/sdk";
import fs from "fs";

const client = new CloudNestClient({
  apiKey: process.env.CLOUDNEST_API_KEY,
});

// Upload from file path
await client.uploadFiles("/path/to/file.jpg");

// Multiple files
await client.uploadFiles(["/path/to/file1.jpg", "/path/to/file2.pdf"]);

// Upload buffer
const buffer = fs.readFileSync("image.jpg");
buffer.name = "image.jpg";
buffer.type = "image/jpeg";
await client.uploadFiles(buffer);`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="browser" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Browser/React Usage</CardTitle>
              <CardDescription>
                Upload File objects from file inputs in the browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`import { CloudNestClient } from "@cloudnest/sdk";

const client = new CloudNestClient({
  apiKey: "your-api-key",
  isBrowser: true,
});

// From file input
const fileInput = document.querySelector('input[type="file"]');
await client.uploadFiles(fileInput.files[0]);

// Multiple files
await client.uploadFiles(Array.from(fileInput.files));

// In React component
function FileUpload() {
  const handleUpload = async (event) => {
    const files = event.target.files;
    const result = await client.uploadFiles(files[0]);
    console.log('Uploaded:', result.data);
  };

  return <input type="file" onChange={handleUpload} />;
}`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="nextjs" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Next.js Server Actions</CardTitle>
              <CardDescription>
                Use with Next.js App Router server actions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`// app/upload/page.tsx
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
}`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <Card id="errors" className="mb-6 scroll-mt-24">
            <CardHeader>
              <CardTitle>Error Handling</CardTitle>
              <CardDescription>
                Handle different types of upload errors gracefully.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    background: backgroundColor,
                    padding: "1rem",
                  }}
                >
                  {`import { ValidationError, UploadError } from "@cloudnest/sdk/errors";

try {
  const result = await client.uploadFiles(files);
  console.log('Success:', result.data);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log("Invalid file type:", error.message);
  } else if (error instanceof UploadError) {
    console.log("Upload failed:", error.message);
  } else {
    console.error("Unexpected error:", error);
  }
}`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>

          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Package Information
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
              Use only the official package name{" "}
              <code className="rounded bg-gray-200 px-1 py-0.5 text-xs dark:bg-gray-800">
                @cloudnest/sdk
              </code>
              . For detailed information on all methods, types, and advanced
              usage, visit the{" "}
              <a
                href="https://www.npmjs.com/package/@cloudnest/sdk"
                className="underline font-medium text-primary hover:text-red-700 dark:hover:text-red-400"
                target="_blank"
                rel="noopener noreferrer"
              >
                @cloudnest/sdk package on npm
              </a>
              .
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Supports: Node.js 16+, Modern browsers, Next.js 13+, TypeScript
              4.5+
            </p>
          </div>
        </div>

        <div>
          <h2 id="rest" className="mb-6 scroll-mt-24 text-lg font-bold">Direct API Usage</h2>
          <Card>
            <CardHeader>
              <CardTitle>REST API</CardTitle>
              <CardDescription>
                Interact with the CloudNest API directly using standard HTTP
                requests if you prefer not to use the SDK.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-lg border">
                <SyntaxHighlighter
                  language="javascript"
                  style={codeTheme}
                  customStyle={{
                    margin: 0,
                    padding: "1rem",
                    background: backgroundColor,
                  }}
                >
                  {`async function uploadFileDirectly(apiKey, file) {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('provider', 'GOOGLE_DRIVE'); // optional: S3, GOOGLE_DRIVE, TELEGRAM
  
  try {
    const response = await fetch('${public_baseurl}/v1/files/upload', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`
      },
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(\`HTTP error! Status: \${response.status}\`);
    }
    
    const data = await response.json();
    console.log('Upload successful:', data);
    return data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
}

// Example Usage
// uploadFileDirectly('your-api-key', fileObject);`}
                </SyntaxHighlighter>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </SiteLayout>
    </>
  );
};

export default Docs;
