import { useState } from "react";
import { toast } from "sonner";
import { Download, History, Loader2, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetFileVersionsQuery,
  useRestoreFileVersionMutation,
} from "@/features/versions/versionsAPI";
import { FileType } from "@/features/files/filesType";

type Props = {
  file: FileType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const VersionsDialog = ({ file, open, onOpenChange }: Props) => {
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { data, isLoading } = useGetFileVersionsQuery(file?._id ?? "", {
    skip: !file?._id,
  });
  const [restore] = useRestoreFileVersionMutation();

  if (!file) return null;
  const versions = [...(data?.versions ?? [])].reverse(); // newest first

  const handleRestore = async (versionId: string) => {
    setRestoringId(versionId);
    try {
      await restore(versionId).unwrap();
      toast.success("Version restored as the latest revision");
    } catch (err) {
      toast.error((err as { data?: { message?: string } })?.data?.message ?? "Restore failed");
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Version history
          </DialogTitle>
          <DialogDescription className="truncate">
            {file.originalName}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        )}

        {!isLoading && versions.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No version history yet. Versions are captured when you re-upload a file
            with the “Keep as new version” conflict policy.
          </p>
        )}

        <div className="max-h-[60vh] space-y-2 overflow-auto">
          {versions.map((v) => (
            <div key={v._id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={v.isLatest ? "default" : "secondary"}>v{v.versionNumber}</Badge>
                  {v.isLatest && <span className="text-xs text-muted-foreground">current</span>}
                </div>
                <p className="mt-1 truncate text-sm">{v.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {v.formattedSize} · {new Date(v.createdAt).toLocaleString()}
                  {v.checksumSha256 ? ` · ${v.checksumSha256.slice(0, 12)}…` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" asChild>
                  <a href={v.url} download={v.originalName} aria-label="Download this version">
                    <Download className="size-4" />
                  </a>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={v.isLatest || restoringId === v._id}
                  onClick={() => handleRestore(v._id)}
                >
                  {restoringId === v._id ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )}
                  Restore
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
