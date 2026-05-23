import { RowSelectionState } from "@tanstack/react-table";
import { useMemo } from "react";
import { DataTable } from "../../data-table";
import { createListColumns } from "./column";
import { FileType, FolderType } from "@/features/files/filesType";
import { FolderCard } from "@/components/folder-card";

type Props = {
  data: FileType[];
  folders: FolderType[];
  selectedFiles: FileType[];
  setSelectedFiles: React.Dispatch<React.SetStateAction<FileType[]>>;
  onOpenFolder: (folder: FolderType) => void;
  onPreviewFile: (file: FileType) => void;
  onMoveFile?: (file: FileType) => void;
  onDeleteFile?: (file: FileType) => void;
  onMoveFolder?: (folder: FolderType) => void;
  onDeleteFolder?: (folder: FolderType) => void;
  isShowPagination: boolean;
  pagination: {
    totalCount: number;
    totalPages: number;
    pageNumber: number;
    pageSize: number;
  };
  isLoading: boolean;
  setPagination: React.Dispatch<
    React.SetStateAction<{
      pageNumber: number;
      pageSize: number;
    }>
  >;
};

const ListView = (props: Props) => {
  const {
    data,
    folders,
    isShowPagination = false,
    pagination,
    setPagination,
    selectedFiles,
    setSelectedFiles,
    onOpenFolder,
    onPreviewFile,
    onMoveFile,
    onDeleteFile,
    onMoveFolder,
    onDeleteFolder,
    isLoading,
  } = props;

  const columns = useMemo(
    () =>
      createListColumns({
        onPreview: onPreviewFile,
        onMove: onMoveFile,
        onDelete: onDeleteFile,
      }),
    [onPreviewFile, onMoveFile, onDeleteFile]
  );

  const rowSelection = useMemo(() => {
    const state: Record<string, boolean> = {};
    selectedFiles.forEach((file) => {
      state[file._id] = true;
    });
    return state;
  }, [selectedFiles]);

  const handlePageChange = (pageNumber: number) => {
    setPagination((prev) => ({ ...prev, pageNumber }));
  };

  const handlePageSizeChange = (pageSize: number) => {
    setPagination((prev) => ({ ...prev, pageSize }));
  };

  const handleRowSelectionChange = (
    updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)
  ) => {
    const nextState =
      typeof updater === "function" ? updater(rowSelection) : updater;
    const selectedIds = Object.keys(nextState).filter((key) => nextState[key]);
    const selectedObjects = data.filter((file: FileType) =>
      selectedIds.includes(file?._id)
    );
    setSelectedFiles(selectedObjects);
  };

  return (
    <div>
      {folders.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onOpen={onOpenFolder}
              onMove={onMoveFolder}
              onDelete={onDeleteFolder}
            />
          ))}
        </div>
      )}
      <DataTable
        columns={columns || []}
        data={data || []}
        isLoading={isLoading}
        showSearch={false}
        selection={true}
        isShowPagination={isShowPagination}
        pagination={{
          totalItems: pagination.totalCount,
          totalPages: pagination.totalPages,
          pageNumber: pagination.pageNumber,
          pageSize: pagination.pageSize,
        }}
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
};

export default ListView;
