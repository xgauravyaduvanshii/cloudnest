/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileUploader, type FileUploaderRef } from "@/components/file-uploader";
import { useCreateUploadJobMutation } from "@/features/uploadJobs/uploadJobsAPI";
import {
  ConflictPolicy,
  UploadJobMode,
} from "@/features/uploadJobs/uploadJobsType";
import { StorageProvider } from "@/features/files/filesType";
import { toast } from "sonner";

const normalizeRelativePath = (path: string | undefined, fallback: string) => {
  const cleanPath = (path || fallback)
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

  return cleanPath || fallback;
};

const getRelativePath = (file: File) => {
  const fileWithPath = file as File & {
    webkitRelativePath?: string;
    path?: string;
  };

  return normalizeRelativePath(
    fileWithPath.webkitRelativePath || fileWithPath.path,
    file.name
  );
};

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const FileUploaderDialog = (props: {
  children: React.ReactNode;
  folderId?: string | null;
  providerFolderId?: string | null;
  storageAccountId?: string | null;
  provider: StorageProvider;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mode, setMode] = useState<UploadJobMode>("FLAT");
  const [conflictPolicy, setConflictPolicy] = useState<ConflictPolicy>("SKIP");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileUploaderRef = useRef<FileUploaderRef>(null);

  const [createUploadJob] = useCreateUploadJobMutation();

  const handleUploadButtonClick = () => {
    if (selectedFiles.length === 0) {
      toast.info("Please select files to upload");
      return;
    }

    setIsSubmitting(true);

    const totalFiles = selectedFiles.length;
    const formData = new FormData();
    formData.append("provider", props.provider);
    if (props.folderId) formData.append("folderId", props.folderId);
    if (props.providerFolderId)
      formData.append("providerFolderId", props.providerFolderId);
    if (props.storageAccountId)
      formData.append("storageAccountId", props.storageAccountId);
    formData.append("mode", mode);
    formData.append("conflictPolicy", conflictPolicy);
    formData.append("clientRequestId", uuid());
    selectedFiles.forEach((file) => {
      formData.append("files", file);
      formData.append("relativePaths", getRelativePath(file));
    });

    createUploadJob(formData)
      .unwrap()
      .then(() => {
        toast.success(`Queued ${totalFiles} file(s) for upload`, {
          description: "Track progress in the Upload activity panel.",
        });
        setIsOpen(false);
        fileUploaderRef.current?.clearSelectedFiles();
        setSelectedFiles([]);
      })
      .catch((error) => {
        console.log(error);
        toast.error("Failed to start upload", {
          description: error?.data?.message || "Please try again later",
        });
      })
      .finally(() => setIsSubmitting(false));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{props.children}</DialogTrigger>
      <DialogContent className="w-full sm:max-w-[600px] p-6">
        <DialogHeader>
          <DialogTitle>Upload files</DialogTitle>
          <DialogDescription className="sr-only">
            Select files from your device and upload them to your storage.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 w-full">
          <FileUploader
            ref={fileUploaderRef}
            onFilesSelected={setSelectedFiles}
            maxFileSize={1024 * 1024 * 1024} // 1GB
            allowFolderSelection
            acceptedFileTypes={{
              "image/*": [".jpeg", ".png", ".gif", ".svg", ".jpg"],
              "audio/*": [".mp3", ".wav", ".ogg", ".m4a", ".webm"],
              "video/*": [".mp4", ".webm", ".ogg", ".mov"],
              "application/pdf": [".pdf"],
              "application/msword": [".doc"],
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                [".docx"],
              "application/vnd.ms-excel": [".xls"],
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                [".xlsx"],
              "application/vnd.ms-powerpoint": [".ppt"],
              "application/vnd.openxmlformats-officedocument.presentationml.presentation":
                [".pptx"],
              "application/zip": [".zip"],
              "application/x-rar-compressed": [".rar"],
              "application/x-tar": [".tar"],
              "text/plain": [".txt"],
            }}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 pb-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Folder structure
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as UploadJobMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FLAT">
                  Flat — all files in the target folder
                </SelectItem>
                <SelectItem value="PRESERVE_STRUCTURE">
                  Preserve nested folder structure
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Name conflicts
            </Label>
            <Select
              value={conflictPolicy}
              onValueChange={(v) => setConflictPolicy(v as ConflictPolicy)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKIP">Skip duplicates (default)</SelectItem>
                <SelectItem value="RENAME">Rename to keep both</SelectItem>
                <SelectItem value="VERSION">Keep as new version</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button
            onClick={handleUploadButtonClick}
            className="hover:bg-primay/80 cursor-pointer text-white w-full disabled:opacity-80 disabled:cursor-not-allowed"
            disabled={selectedFiles.length === 0 || isSubmitting}
          >
            {isSubmitting ? "Queuing..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
