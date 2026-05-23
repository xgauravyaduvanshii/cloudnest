import { FolderOpen } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { FileCardSkeleton } from "@/components/file-card/skeleton";
import { FileType, FolderType } from "@/features/files/filesType";
import FileCard from "../../file-card";
import { FolderCard } from "@/components/folder-card";

type Props = {
  data: FileType[];
  folders: FolderType[];
  isLoading: boolean;
  selectedFiles: FileType[];
  onToggleSelect: (file: FileType) => void;
  onOpenFolder: (folder: FolderType) => void;
  onPreviewFile: (file: FileType) => void;
  onMoveFile?: (file: FileType) => void;
  onDeleteFile?: (file: FileType) => void;
  onMoveFolder?: (folder: FolderType) => void;
  onDeleteFolder?: (folder: FolderType) => void;
};

const GridView = (props: Props) => {
  const {
    selectedFiles,
    onToggleSelect,
    data,
    folders,
    isLoading,
    onOpenFolder,
    onPreviewFile,
    onMoveFile,
    onDeleteFile,
    onMoveFolder,
    onDeleteFolder,
  } = props;

  const handleFileSelection = (file: FileType) => {
    onToggleSelect(file);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {isLoading ? (
        Array.from({ length: 10 }).map((_, i) => <FileCardSkeleton key={i} />)
      ) : folders.length > 0 || data.length > 0 ? (
        <>
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onOpen={onOpenFolder}
              onMove={onMoveFolder}
              onDelete={onDeleteFolder}
            />
          ))}
          {data.map((file) => {
            const isSelected = selectedFiles.some(
              (selectedFile) => selectedFile._id === file._id
            );
            return (
              <FileCard
                key={file._id}
                file={file}
                isSelected={isSelected}
                toggleFileSelection={handleFileSelection}
                onPreview={onPreviewFile}
                onMove={onMoveFile}
                onDelete={onDeleteFile}
              />
            );
          })}
        </>
      ) : (
        <div className="col-span-5">
          <EmptyState
            title="No Files found"
            description="You haven’t any files. Upload to get started."
            icon={FolderOpen}
          />
        </div>
      )}
    </div>
  );
};

export default GridView;
