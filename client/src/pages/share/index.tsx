import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Cloud, Download, Lock, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useResolveShareQuery } from "@/features/shares/sharesAPI";

const API_BASE = import.meta.env.VITE_API_URL as string;

const SharePage = () => {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState<string | undefined>(undefined);

  const { data, isLoading, error } = useResolveShareQuery(
    { token: token ?? "", password: submitted },
    { skip: !token },
  );

  const errStatus = (error as { status?: number } | undefined)?.status;
  const errMessage =
    (error as { data?: { message?: string } } | undefined)?.data?.message ??
    "This link is unavailable.";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-4">
          <Cloud className="size-6" />
          <span className="font-semibold">CloudNest</span>
          <span className="ml-auto text-sm text-muted-foreground">Shared with you</span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-xl font-semibold">Shared files</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Anyone with this link can view the files below{data?.share.hasPassword ? " (password required)" : ""}.
        </p>

        {isLoading && <Skeleton className="mt-6 h-32 w-full" />}

        {errStatus === 403 && data === undefined && (
          <Card className="mt-6 space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-medium">
              {errMessage.toLowerCase().includes("password") ? (
                <Lock className="size-4" />
              ) : (
                <ShieldAlert className="size-4" />
              )}
              {errMessage}
            </div>
            {errMessage.toLowerCase().includes("password") && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setSubmitted(password.trim() || undefined);
                }}
              >
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="submit">Unlock</Button>
              </form>
            )}
          </Card>
        )}

        {data && (
          <div className="mt-6 space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary" className="capitalize">
                {data.share.permission}
              </Badge>
              {data.share.expiresAt && (
                <span>Expires {new Date(data.share.expiresAt).toLocaleString()}</span>
              )}
              {data.share.maxDownloads !== null && (
                <span>
                  {data.share.downloadCount}/{data.share.maxDownloads} downloads used
                </span>
              )}
            </div>

            {data.files.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No files are available in this share.
              </p>
            )}

            {data.files.map((f) => {
              const downloadUrl = `${API_BASE}/share/${token}/files/${f._id}${
                submitted ? `?password=${encodeURIComponent(submitted)}` : ""
              }`;
              return (
                <div
                  key={f._id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.originalName}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.formattedSize} · {f.ext.toUpperCase()}
                    </p>
                  </div>
                  <Button asChild size="sm">
                    <a href={downloadUrl} download={f.originalName}>
                      <Download className="size-4" />
                      Download
                    </a>
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {!isLoading && !data && errStatus !== 403 && (
          <p className="mt-6 text-sm text-muted-foreground">{errMessage}</p>
        )}

        <div className="mt-8">
          <Link to="/" className="text-sm text-muted-foreground underline">
            Back to CloudNest
          </Link>
        </div>
      </main>
    </div>
  );
};

export default SharePage;
