/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useCallback,
  useState,
  useImperativeHandle,
  forwardRef,
  useRef,
} from "react";
import Dropzone from "react-dropzone";
import {
  CloudUploadIcon,
  FileIcon,
  FolderOpen,
  MousePointerSquareDashed,
  X,
} from "lucide-react";
import { toast } from "sonner";

interface FileUploaderProps {
  maxFileSize?: number;
  acceptedFileTypes?: Record<string, string[]>;
  allowFolderSelection?: boolean;
  onFilesSelected: (files: File[]) => void;
}
export interface FileUploaderRef {
  clearSelectedFiles: () => void;
  getSelectedFiles: () => File[];
}

const DEFAULT_MAX_FILE_SIZE = 100 * 1024 * 1024;

export const FileUploader = forwardRef<FileUploaderRef, FileUploaderProps>(
  (
    {
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      acceptedFileTypes,
      allowFolderSelection = false,
      onFilesSelected,
    },
    ref
  ) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const folderInputRef = useRef<HTMLInputElement>(null);

    const normalizeFilePath = (path: string | undefined, fallback: string) => {
      const cleanPath = (path || fallback)
        .replace(/\\/g, "/")
        .split("/")
        .map((part) => part.trim())
        .filter((part) => part && part !== "." && part !== "..")
        .join("/");

      return cleanPath || fallback;
    };

    const getFilePath = (file: File) => {
      const fileWithPath = file as File & {
        webkitRelativePath?: string;
        path?: string;
      };

      return normalizeFilePath(
        fileWithPath.webkitRelativePath || fileWithPath.path,
        file.name
      );
    };

    const addFiles = useCallback(
      (incomingFiles: File[]) => {
        const newFiles = incomingFiles.filter((file) => {
          if (file.size > maxFileSize) {
            toast.error(
              `File "${file.name}" exceeds the ${maxFileSize / (1024 * 1024)}MB limit.`
            );
            return false;
          }
          return !selectedFiles.some(
            (existingFile) =>
              getFilePath(existingFile) === getFilePath(file) &&
              existingFile.size === file.size
          );
        });

        if (newFiles.length > 0) {
          const updatedFiles = [...selectedFiles, ...newFiles];
          setSelectedFiles(updatedFiles);
          onFilesSelected(updatedFiles);
        }
      },
      [maxFileSize, selectedFiles, onFilesSelected]
    );

    // Expose functions via ref
    useImperativeHandle(ref, () => ({
      clearSelectedFiles: () => {
        setSelectedFiles([]);
        onFilesSelected([]); // Notify parent that files are cleared
      },
      getSelectedFiles: () => selectedFiles,
    }));

    const handleDrop = useCallback(
      (acceptedFiles: File[], rejectedFiles: any[]) => {
        rejectedFiles.forEach((rejectedFile) => {
          if (rejectedFile.file.size > maxFileSize) {
            toast.error(
              `File "${rejectedFile.file.name}" exceeds the ${maxFileSize / (1024 * 1024)}MB limit.`
            );
          } else {
            toast.error(`File "${rejectedFile.file.name}" type not allowed.`);
          }
        });

        addFiles(acceptedFiles);
      },
      [addFiles, maxFileSize]
    );

    const handleFolderSelect = useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        addFiles(files);
        event.target.value = "";
      },
      [addFiles]
    );

    const removeFile = useCallback(
      (fileToRemove: File) => {
        const updatedFiles = selectedFiles.filter(
          (file) => file !== fileToRemove
        );
        setSelectedFiles(updatedFiles);
        onFilesSelected(updatedFiles); // Notify parent about updated selected files
      },
      [selectedFiles, onFilesSelected]
    );

    return (
      <div className="w-full">
        {allowFolderSelection && (
          <input
            ref={folderInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFolderSelect}
            {...({ webkitdirectory: "true", directory: "true" } as any)}
          />
        )}
        <Dropzone
          multiple={true}
          accept={acceptedFileTypes}
          maxSize={maxFileSize}
          onDrop={handleDrop}
          onDropRejected={(rejectedFiles) => {
            if (rejectedFiles[0].file.size > DEFAULT_MAX_FILE_SIZE) {
              toast.error("File size exceeds the limit");
            }
          }}
        >
          {({ getRootProps, getInputProps }) => (
            <div
              {...getRootProps()}
              className="border border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer min-h-[400px] flex flex-col items-center justify-center overflow-hidden"
            >
              <input {...getInputProps()} />
              {selectedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1">
                  <CloudUploadIcon className="h-12 w-12 text-gray-500 mb-1" />
                  <span className="font-semibold text-primary text-sm leading-6 hover:text-primary-muted">
                    Choose files or drag and drop
                  </span>
                  <p className="text-sm text-gray-500">All file types</p>
                  {allowFolderSelection && (
                    <button
                      type="button"
                      className="mt-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
                      onClick={(event) => {
                        event.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Choose folder
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex h-[350px] w-full flex-col justify-center gap-2 overflow-y-auto p-2 text-muted-foreground text-sm">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 p-2 border border-muted rounded-md bg-muted/40 text-sm"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileIcon className="h-5 w-5 text-gray-500 shrink-0" />
                        <p
                          className="truncate text-[12px] md:text-sm text-ellipsis whitespace-nowrap max-w-[150px] 
                        md:max-w-11/12
                        lg:max-w-[400px]"
                        >
                          {getFilePath(file)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(file);
                        }}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  {/* 👉 Add More Files Hint */}
                  <p className="flex items-end justify-center gap-1 text-xs text-gray-500 pt-2">
                    <MousePointerSquareDashed className="w-4 h-4 mb-[0.5px] animate-bounce" />
                    <span> Click to add more files.</span>
                  </p>
                  {allowFolderSelection && (
                    <button
                      type="button"
                      className="mx-auto mt-1 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted"
                      onClick={(event) => {
                        event.stopPropagation();
                        folderInputRef.current?.click();
                      }}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Add folder
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Dropzone>
      </div>
    );
  }
);

FileUploader.displayName = "FileUploader";
