import { useEffect, useState } from "react";
import {
  Download,
  ExternalLink,
  FileArchive,
  FileText,
  FolderPlus,
  History,
  Loader2,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileType } from "@/features/files/filesType";
import { getCleanAssetType } from "@/lib/format-utils";
import {
  useEnrichFileMutation,
  useGetFileMetadataQuery,
} from "@/features/ai/aiAPI";
import { ShareDialog } from "@/components/file-actions/share-dialog";
import { VersionsDialog } from "@/components/file-actions/versions-dialog";
import { AddToCollectionDialog } from "@/components/file-actions/add-to-collection-dialog";

type Props = {
  file: FileType | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const isTextPreview = (file: FileType) =>
  file.mimeType.startsWith("text/") ||
  file.mimeType === "application/json" ||
  ["TXT", "CSV", "JSON", "MD"].includes(file.ext.toUpperCase());

export const FilePreviewDialog = ({ file, open, onOpenChange }: Props) => {
  const [text, setText] = useState("");
  const [isLoadingText, setIsLoadingText] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [enrichFile, { isLoading: isEnriching }] = useEnrichFileMutation();
  const { data: metadata } = useGetFileMetadataQuery(file?._id ?? "", {
    skip: !file?._id,
  });

  const runEnrich = async () => {
    if (!file) return;
    try {
      const res = await enrichFile({ fileId: file._id }).unwrap();
      if (res.disabled) toast.info("AI is not enabled on this server");
      else toast.success("Analyzed. Metadata updated.");
    } catch {
      toast.error("Analysis failed");
    }
  };

  useEffect(() => {
    if (!open || !file || !isTextPreview(file)) {
      setText("");
      return;
    }

    let cancelled = false;
    setIsLoadingText(true);
    fetch(file.url)
      .then((response) => response.text())
      .then((value) => {
        if (!cancelled) setText(value.slice(0, 250_000));
      })
      .catch(() => {
        if (!cancelled) setText("Preview failed. Open the file in a new tab.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingText(false);
      });

    return () => {
      cancelled = true;
    };
  }, [file, open]);

  if (!file) return null;

  const typeLabel = getCleanAssetType(file.mimeType, file.ext);
  const ext = file.ext.toUpperCase();
  const openUrl = file.webViewLink || file.url;
  const isGoogleWorkspaceFile =
    file.provider === "GOOGLE_DRIVE" &&
    file.mimeType.startsWith("application/vnd.google-apps.");
  const rendersAsImage =
    file.mimeType.startsWith("image/") ||
    file.mimeType === "application/vnd.google-apps.drawing";
  const rendersAsPdf =
    file.mimeType === "application/pdf" ||
    (isGoogleWorkspaceFile && file.mimeType !== "application/vnd.google-apps.drawing");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(1120px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="truncate pr-10 text-base">
            {file.originalName}
          </DialogTitle>
          <DialogDescription>
            {typeLabel} · {file.formattedSize}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[360px] overflow-auto bg-muted/40 p-4">
          {rendersAsImage && (
            <div className="flex min-h-[60vh] items-center justify-center">
              <img
                src={file.url}
                alt={file.originalName}
                className="max-h-[72vh] max-w-full rounded-md object-contain"
              />
            </div>
          )}

          {file.mimeType.startsWith("video/") && (
            <video
              controls
              className="mx-auto max-h-[72vh] w-full max-w-5xl rounded-md bg-black"
              src={file.url}
            />
          )}

          {file.mimeType.startsWith("audio/") && (
            <div className="mx-auto flex min-h-[340px] max-w-2xl flex-col items-center justify-center gap-5 rounded-md border bg-background p-8">
              <FileText className="size-14 text-muted-foreground" />
              <div className="w-full text-center">
                <div className="mb-3 font-medium">{file.originalName}</div>
                <audio controls className="w-full" src={file.url} />
              </div>
            </div>
          )}

          {rendersAsPdf && (
            <iframe
              title={file.originalName}
              src={file.url}
              className="h-[72vh] w-full rounded-md border bg-background"
            />
          )}

          {isTextPreview(file) && (
            <pre className="max-h-[72vh] overflow-auto whitespace-pre-wrap rounded-md border bg-background p-4 text-sm">
              {isLoadingText ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Loading preview
                </span>
              ) : (
                text
              )}
            </pre>
          )}

          {!rendersAsImage &&
            !file.mimeType.startsWith("video/") &&
            !file.mimeType.startsWith("audio/") &&
            !rendersAsPdf &&
            !isTextPreview(file) && (
              <div className="mx-auto flex min-h-[420px] max-w-xl flex-col items-center justify-center gap-4 rounded-md border bg-background p-8 text-center">
                {["ZIP", "RAR", "TAR"].includes(ext) ? (
                  <FileArchive className="size-16 text-muted-foreground" />
                ) : (
                  <FileText className="size-16 text-muted-foreground" />
                )}
                <div>
                  <div className="font-medium">{file.originalName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Inline preview is not available for this file type.
                  </div>
                </div>
              </div>
            )}
        </div>

        {metadata?.metadata && (metadata.metadata.summary || metadata.metadata.tags?.length) && (
          <div className="border-t px-5 py-3 text-sm">
            <div className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3" /> AI metadata
            </div>
            {metadata.metadata.summary && (
              <p className="text-xs text-muted-foreground">{metadata.metadata.summary}</p>
            )}
            {metadata.metadata.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {metadata.metadata.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">
          <Button variant="outline" onClick={runEnrich} disabled={isEnriching}>
            {isEnriching ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            Analyze
          </Button>
          <Button variant="outline" onClick={() => setCollectionOpen(true)}>
            <FolderPlus className="size-4" />
            Collection
          </Button>
          <Button variant="outline" onClick={() => setVersionsOpen(true)}>
            <History className="size-4" />
            Versions
          </Button>
          <Button variant="outline" onClick={() => setShareOpen(true)}>
            <Share2 className="size-4" />
            Share
          </Button>
          <Button variant="outline" asChild>
            <a href={openUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="size-4" />
              Open
            </a>
          </Button>
          <Button asChild>
            <a href={file.url} download={file.originalName}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        </div>

        <ShareDialog file={file} open={shareOpen} onOpenChange={setShareOpen} />
        <VersionsDialog file={file} open={versionsOpen} onOpenChange={setVersionsOpen} />
        <AddToCollectionDialog
          file={file}
          open={collectionOpen}
          onOpenChange={setCollectionOpen}
        />
      </DialogContent>
    </Dialog>
  );
};
