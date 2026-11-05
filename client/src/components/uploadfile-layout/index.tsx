import { useCallback, useEffect, useMemo, useState } from "react";
import GridView from "./grid-view/grid-view";
import ListView from "./list-view/list-view";
import ToolBar from "./toolbar";
import useDebouncedSearch from "@/hooks/use-debounce-search";
import { LAYOUT_VIEW, LayoutViewType } from "@/constant";
import { toast } from "sonner";
import {
  FileType,
  FolderType,
  StorageProvider,
} from "@/features/files/filesType";
import {
  useDeleteFilesMutation,
  useDeleteFolderMutation,
  useDownloadFilesMutation,
  useGetAllFilesQuery,
  useGetGoogleDriveItemsQuery,
  useMoveFilesMutation,
  useMoveFolderMutation,
  useDeleteGoogleDriveItemMutation,
  useMoveGoogleDriveItemMutation,
} from "@/features/files/filesAPI";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FolderPlus, Home, UploadCloud } from "lucide-react";
import { FileUploaderDialog } from "@/pages/files/_component/fileuploader-dialog";
import { CreateFolderDialog } from "@/pages/files/_component/create-folder-dialog";
import { MoveItemDialog, MovingItem } from "@/pages/files/_component/move-item-dialog";
import { FilePreviewDialog } from "@/components/file-preview-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetEnabledProvidersQuery,
  useGetStorageAccountsQuery,
  useLazyGetGoogleAuthUrlQuery,
} from "@/features/storageAccounts/storageAccountsAPI";

const PROVIDERS: { value: StorageProvider; label: string }[] = [
  { value: "S3", label: "AWS S3" },
  { value: "GOOGLE_DRIVE", label: "Google Drive" },
  { value: "TELEGRAM", label: "Telegram" },
];

type Props = {
  layoutView: LayoutViewType;
  isShowPagination: boolean;
  showToolBar: boolean;
  pageSize?: number;
};

const UploadFileLayout = (props: Props) => {
  const {
    layoutView = LAYOUT_VIEW.GRID,
    isShowPagination,
    showToolBar = true,
  } = props;

  const [filter, setFilter] = useState({
    pageNumber: 1,
    pageSize: props.pageSize || 10,
  });

  const [_layoutView, setLayoutView] = useState<LayoutViewType>(layoutView);
  const [selectedFiles, setSelectedFiles] = useState<FileType[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveBreadcrumbs, setDriveBreadcrumbs] = useState<FolderType[]>([]);
  // Drive pages by continuation token, not offset. Store the token requested for
  // each visited page so Previous/Next replay them; index 0 is always the first page.
  const [drivePageTokens, setDrivePageTokens] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [drivePageIndex, setDrivePageIndex] = useState(0);
  const [previewFile, setPreviewFile] = useState<FileType | null>(null);
  const [activeProvider, setActiveProvider] = useState<StorageProvider>("S3");
  const [selectedGoogleAccountId, setSelectedGoogleAccountId] = useState<
    string | null
  >(null);
  const [movingItem, setMovingItem] = useState<MovingItem>(null);

  const { debouncedTerm, searchTerm, setSearchTerm } = useDebouncedSearch("", {
    delay: 500,
  });
  const { data: enabledProviderData } = useGetEnabledProvidersQuery();
  const { data: storageAccountData } = useGetStorageAccountsQuery();

  const [downloadFiles, { isLoading: isDownloading }] =
    useDownloadFilesMutation();
  const [deleteFiles, { isLoading: isDeleting }] = useDeleteFilesMutation();
  const [moveFiles] = useMoveFilesMutation();
  const [moveFolder] = useMoveFolderMutation();
  const [deleteFolder] = useDeleteFolderMutation();
  const [moveGoogleDriveItem] = useMoveGoogleDriveItemMutation();
  const [deleteGoogleDriveItem] = useDeleteGoogleDriveItemMutation();
  const [getGoogleAuthUrl] = useLazyGetGoogleAuthUrlQuery();

  const enabledProviders = useMemo(() => {
    if (!enabledProviderData) return PROVIDERS.map((provider) => provider.value);
    const enabled = enabledProviderData?.providers
      ?.filter((provider) => provider.isEnabled)
      .map((provider) => provider.provider);
    return enabled || [];
  }, [enabledProviderData]);

  const visibleProviders = useMemo(
    () => PROVIDERS.filter((provider) => enabledProviders.includes(provider.value)),
    [enabledProviders]
  );

  const googleAccounts = useMemo(
    () =>
      (storageAccountData?.accounts || []).filter(
        (account) =>
          account.provider === "GOOGLE_DRIVE" &&
          // After the auth-drop fix an ERROR account with credentials can still
          // be browsed and auto-recovers on the next successful call, so keep it
          // selectable. Only truly unusable states are excluded.
          account.status !== "DISABLED" &&
          account.status !== "PENDING_AUTH",
      ),
    [storageAccountData]
  );
  const hasActiveProvider = enabledProviders.includes(activeProvider);
  const isGoogleDriveLive = activeProvider === "GOOGLE_DRIVE";

  useEffect(() => {
    if (!enabledProviders.includes(activeProvider)) {
      setActiveProvider(enabledProviders[0] || "S3");
      setCurrentFolderId(null);
      setDriveFolderId(null);
      setDriveBreadcrumbs([]);
    }
  }, [activeProvider, enabledProviders]);

  useEffect(() => {
    if (activeProvider !== "GOOGLE_DRIVE") return;
    if (!selectedGoogleAccountId && googleAccounts[0]) {
      setSelectedGoogleAccountId(googleAccounts[0].id);
    }
    if (
      selectedGoogleAccountId &&
      !googleAccounts.some((account) => account.id === selectedGoogleAccountId)
    ) {
      setSelectedGoogleAccountId(googleAccounts[0]?.id || null);
      setDriveFolderId(null);
      setDriveBreadcrumbs([]);
    }
  }, [activeProvider, googleAccounts, selectedGoogleAccountId]);

  const { data, isLoading, isFetching } = useGetAllFilesQuery({
    keyword: debouncedTerm,
    folderId: currentFolderId,
    provider: activeProvider,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize,
  }, {
    skip: !hasActiveProvider || activeProvider === "GOOGLE_DRIVE",
  });

  const {
    data: googleDriveData,
    isLoading: isGoogleDriveLoading,
    isFetching: isGoogleDriveFetching,
    error: googleDriveError,
  } = useGetGoogleDriveItemsQuery(
    {
      accountId: selectedGoogleAccountId || "",
      folderId: driveFolderId,
      keyword: debouncedTerm,
      pageSize: filter.pageSize,
      pageToken: drivePageTokens[drivePageIndex],
    },
    {
      skip:
        !hasActiveProvider ||
        activeProvider !== "GOOGLE_DRIVE" ||
        !selectedGoogleAccountId,
    }
  );

  // Reset Drive paging whenever the browsed location or page size changes.
  useEffect(() => {
    setDrivePageTokens([undefined]);
    setDrivePageIndex(0);
  }, [driveFolderId, selectedGoogleAccountId, debouncedTerm, filter.pageSize]);

  const driveHasMore = !!googleDriveData?.pagination.hasMore;

  // The backend surfaces a revoked/expired Google grant as a typed 409
  // GOOGLE_REAUTH_REQUIRED. Rather than a dead-end error, prompt to reconnect.
  const needsGoogleReauth =
    activeProvider === "GOOGLE_DRIVE" &&
    (googleDriveError as any)?.status === 409 &&
    (googleDriveError as any)?.data?.errorCode === "GOOGLE_REAUTH_REQUIRED";

  const reconnectGoogle = async () => {
    try {
      const res = await getGoogleAuthUrl("USER").unwrap();
      if (res?.url) {
        window.open(res.url, "_blank", "noopener");
      } else {
        toast.error("Could not start Google reconnect.");
      }
    } catch {
      toast.error("Could not start Google reconnect.");
    }
  };
  const driveNext = () => {
    const token = googleDriveData?.pagination.nextPageToken;
    if (!token) return;
    setDrivePageTokens((prev) =>
      drivePageIndex + 1 >= prev.length ? [...prev, token] : prev,
    );
    setDrivePageIndex((prev) => prev + 1);
  };
  const drivePrev = () =>
    setDrivePageIndex((prev) => Math.max(0, prev - 1));

  const sourceData = isGoogleDriveLive ? googleDriveData : data;
  const fileData = sourceData?.files || [];
  const folderData = sourceData?.folders || [];
  const breadcrumbs = isGoogleDriveLive
    ? driveBreadcrumbs
    : data?.breadcrumbs || [];

  // Numeric (offset) pagination only applies to S3; Drive uses token Previous/Next.
  const pagination = {
    totalCount: data?.pagination.totalCount || 0,
    totalPages: data?.pagination.totalPages || 0,
    pageNumber: filter.pageNumber,
    pageSize: filter.pageSize,
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleLayoutView = (view: LayoutViewType) => {
    setLayoutView(view);
  };

  const switchProvider = (provider: StorageProvider) => {
    setActiveProvider(provider);
    setCurrentFolderId(null);
    setDriveFolderId(null);
    setDriveBreadcrumbs([]);
    setSelectedFiles([]);
    setFilter((current) => ({ ...current, pageNumber: 1 }));
  };

  const openFolder = (folder: FolderType) => {
    if (isGoogleDriveLive) {
      setDriveFolderId(folder.id);
      setDriveBreadcrumbs((current) => [...current, folder]);
    } else {
      setCurrentFolderId(folder.id);
    }
    setSelectedFiles([]);
    setFilter((current) => ({ ...current, pageNumber: 1 }));
  };

  const goToFolder = (folderId: string | null) => {
    if (isGoogleDriveLive) {
      setDriveFolderId(folderId);
      setDriveBreadcrumbs((current) =>
        folderId
          ? current.slice(0, current.findIndex((folder) => folder.id === folderId) + 1)
          : []
      );
    } else {
      setCurrentFolderId(folderId);
    }
    setSelectedFiles([]);
    setFilter((current) => ({ ...current, pageNumber: 1 }));
  };

  const handleToggleSelected = (file: FileType) => {
    const isSelected = selectedFiles.find((f) => f._id === file._id);
    if (isSelected) {
      setSelectedFiles((prev) => prev.filter((f) => f._id !== file._id));
    } else {
      setSelectedFiles((prev) => [...prev, file]);
    }
  };

  const handleClear = () => {
    setSelectedFiles([]);
  };

  const handleCopy = () => {
    const urls = selectedFiles
      .map((file) => {
        return file.url;
      })
      .join("\n");
    navigator.clipboard
      .writeText(urls)
      .then(() => {
        setSelectedFiles([]);
        toast.success(`Copied ${selectedFiles.length} file url `);
      })
      .catch(() => {
        toast.error("Failed to copy links");
      });
  };

  const handleDelete = () => {
    if (isDeleting) return;
    const fileIds = selectedFiles?.map((file) => file._id);
    if (!fileIds.length) {
      toast.error("No file selected");
      return;
    }

    const toastId = toast.loading(
      `Deleting ${fileIds.length} selected file(s)...`
    );
    deleteFiles(fileIds)
      .unwrap()
      .then((res) => {
        toast.dismiss(toastId);
        if (res.failedCount > 0) {
          toast.warning(
            `Deleted ${res.deletedCount} file(s). ${res.failedCount} failed.`,
            { description: "Some files could not be deleted." }
          );
        } else {
          toast.success(`Successfully deleted ${res.deletedCount} file(s).`);
        }
        setSelectedFiles([]);
      })
      .catch(() => {
        toast.dismiss(toastId);
        toast.error("Failed to delete files. Please try again.");
      });
  };

  const handleDowload = () => {
    if (isDownloading) return;
    const fileIds = selectedFiles?.map((file) => file._id);
    if (!fileIds.length) {
      toast.error("No file selected");
      return;
    }

    const toastId = toast.loading("Preparing your download...", {
      duration: Infinity,
    });

    downloadFiles(fileIds)
      .unwrap()
      .then((res) => {
        toast.dismiss(toastId);
        if (res.downloadUrl) {
          const link = document.createElement("a");
          link.href = res.downloadUrl;
          link.download = "";
          document.body.appendChild(link);
          link.click();
          link.remove();

          const message = res.isZip
            ? "Zip file is downloading..."
            : "Your file is downloading...";

          toast.success(
            <>
              {message}
              <br />
              If it doesn't start,{" "}
              <a
                href={res.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline !text-black"
              >
                click here
              </a>
            </>
          );
        } else {
          toast.error("Download URL missing");
        }
      })
      .catch(() => {
        toast.dismiss(toastId);
        toast.error("Download failed Try again");
      })
      .finally(() => {
        setSelectedFiles([]);
      });
  };

  const handlePreviewFile = useCallback((file: FileType) => {
    setPreviewFile(file);
  }, []);

  const handleDeleteFile = async (file: FileType) => {
    try {
      if (isGoogleDriveLive && selectedGoogleAccountId) {
        await deleteGoogleDriveItem({
          accountId: selectedGoogleAccountId,
          itemId: file.id || file._id,
        }).unwrap();
      } else {
        await deleteFiles([file._id]).unwrap();
      }
      toast.success("File deleted");
    } catch {
      toast.error("Failed to delete file");
    }
  };

  const handleDeleteFolder = async (folder: FolderType) => {
    try {
      if (isGoogleDriveLive && selectedGoogleAccountId) {
        await deleteGoogleDriveItem({
          accountId: selectedGoogleAccountId,
          itemId: folder.id,
        }).unwrap();
      } else {
        await deleteFolder({
          folderId: folder.id,
          provider: activeProvider,
        }).unwrap();
      }
      toast.success("Folder deleted");
    } catch {
      toast.error(
        isGoogleDriveLive
          ? "Failed to delete folder"
          : "Folder must be empty before deleting"
      );
    }
  };

  const openMoveFile = (file: FileType) => {
    setMovingItem({
      id: file.id || file._id,
      name: file.originalName,
      type: "file",
    });
  };

  const openMoveFolder = (folder: FolderType) => {
    setMovingItem({
      id: folder.id,
      name: folder.name,
      type: "folder",
    });
  };

  const submitMove = async (targetFolderId: string | null) => {
    if (!movingItem) return;
    try {
      if (isGoogleDriveLive && selectedGoogleAccountId) {
        await moveGoogleDriveItem({
          accountId: selectedGoogleAccountId,
          itemId: movingItem.id,
          targetFolderId,
        }).unwrap();
      } else if (movingItem.type === "file") {
        await moveFiles({
          fileIds: [movingItem.id],
          targetFolderId,
          provider: activeProvider,
        }).unwrap();
      } else {
        await moveFolder({
          folderId: movingItem.id,
          targetFolderId,
          provider: activeProvider,
        }).unwrap();
      }
      toast.success("Item moved");
      setMovingItem(null);
    } catch {
      toast.error("Failed to move item");
    }
  };

  if (!visibleProviders.length) {
    return (
      <div className="rounded-md border p-4 text-sm text-muted-foreground">
        No storage provider is enabled right now.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 grid gap-2 md:grid-cols-3">
        {visibleProviders.map((provider) => (
          <button
            key={provider.value}
            className={`rounded-md border px-4 py-3 text-left transition-colors ${
              activeProvider === provider.value
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:bg-muted"
            }`}
            onClick={() => switchProvider(provider.value)}
          >
            <div className="text-sm font-medium">{provider.label}</div>
            <div
              className={`text-xs ${
                activeProvider === provider.value
                  ? "text-primary-foreground/80"
                  : "text-muted-foreground"
              }`}
            >
              Files and folders stored with {provider.label}
            </div>
          </button>
        ))}
      </div>
      {isGoogleDriveLive && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            value={selectedGoogleAccountId || ""}
            onValueChange={(value) => {
              setSelectedGoogleAccountId(value);
              setDriveFolderId(null);
              setDriveBreadcrumbs([]);
              setSelectedFiles([]);
            }}
          >
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select Google Drive account" />
            </SelectTrigger>
            <SelectContent>
              {googleAccounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.displayName}
                  {account.externalEmail ? ` (${account.externalEmail})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!googleAccounts.length && (
            <span className="text-sm text-muted-foreground">
              Connect a Google Drive account from Storage.
            </span>
          )}
        </div>
      )}
      {needsGoogleReauth && (
        <div className="mb-4 flex flex-col items-start justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4 sm:flex-row sm:items-center">
          <div className="text-sm">
            <div className="font-medium text-amber-600 dark:text-amber-300">
              Google Drive needs to be reconnected
            </div>
            <div className="text-muted-foreground">
              Your Google access was revoked or expired. Reconnect to restore
              browsing — your files are safe.
            </div>
          </div>
          <Button size="sm" onClick={reconnectGoogle}>
            Reconnect Google Drive
          </Button>
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <button
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
          onClick={() => goToFolder(null)}
        >
          <Home className="size-4" />
          Home
        </button>
        {breadcrumbs.map((folder) => (
          <div key={folder.id} className="inline-flex items-center gap-1">
            <ChevronRight className="size-4" />
            <button
              className="max-w-48 truncate rounded-md px-2 py-1 hover:bg-muted hover:text-foreground"
              onClick={() => goToFolder(folder.id)}
            >
              {folder.name}
            </button>
          </div>
        ))}
      </div>
      {showToolBar && (
        <ToolBar
          layoutView={_layoutView}
          searchTerm={searchTerm}
          isLoading={isGoogleDriveLive ? isGoogleDriveFetching : isFetching}
          isSelected={selectedFiles?.length > 0 || false}
          noOfFileselected={selectedFiles?.length}
          handleSearch={handleSearch}
          handleLayoutView={handleLayoutView}
          onClear={handleClear}
          onDelete={handleDelete}
          onCopy={handleCopy}
          onDownload={handleDowload}
          actions={
            <>
              <CreateFolderDialog
                parentId={isGoogleDriveLive ? driveFolderId : currentFolderId}
                provider={activeProvider}
                accountId={selectedGoogleAccountId}
                isGoogleDriveLive={isGoogleDriveLive}
              >
                <Button variant="outline">
                  <FolderPlus className="size-4" />
                  New folder
                </Button>
              </CreateFolderDialog>
              <FileUploaderDialog
                folderId={isGoogleDriveLive ? null : currentFolderId}
                providerFolderId={isGoogleDriveLive ? driveFolderId : null}
                storageAccountId={
                  isGoogleDriveLive ? selectedGoogleAccountId : null
                }
                provider={activeProvider}
              >
                <Button>
                  <UploadCloud className="size-4" />
                  Upload
                </Button>
              </FileUploaderDialog>
            </>
          }
        />
      )}
      <div className="mt-1">
        {_layoutView === LAYOUT_VIEW.LIST ? (
          <ListView
            data={fileData}
            folders={folderData}
            isLoading={isGoogleDriveLive ? isGoogleDriveLoading : isLoading}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            onOpenFolder={openFolder}
            onPreviewFile={handlePreviewFile}
            onMoveFile={openMoveFile}
            onDeleteFile={handleDeleteFile}
            onMoveFolder={openMoveFolder}
            onDeleteFolder={handleDeleteFolder}
            isShowPagination={isShowPagination && !isGoogleDriveLive}
            pagination={pagination}
            setPagination={setFilter}
          />
        ) : (
          <GridView
            data={fileData}
            folders={folderData}
            isLoading={isGoogleDriveLive ? isGoogleDriveFetching : isFetching}
            selectedFiles={selectedFiles}
            onToggleSelect={handleToggleSelected}
            onOpenFolder={openFolder}
            onPreviewFile={handlePreviewFile}
            onMoveFile={openMoveFile}
            onDeleteFile={handleDeleteFile}
            onMoveFolder={openMoveFolder}
            onDeleteFolder={handleDeleteFolder}
          />
        )}
      </div>
      {isGoogleDriveLive && isShowPagination && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            Page {drivePageIndex + 1}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={drivePageIndex === 0 || isGoogleDriveFetching}
              onClick={drivePrev}
            >
              <ChevronLeft className="size-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={!driveHasMore || isGoogleDriveFetching}
              onClick={driveNext}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
      <MoveItemDialog
        item={movingItem}
        open={!!movingItem}
        folders={folderData}
        currentFolderId={isGoogleDriveLive ? driveFolderId : currentFolderId}
        onOpenChange={(open) => {
          if (!open) setMovingItem(null);
        }}
        onMove={submitMove}
      />
      <FilePreviewDialog
        file={previewFile}
        open={!!previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      />
    </div>
  );
};

export default UploadFileLayout;
