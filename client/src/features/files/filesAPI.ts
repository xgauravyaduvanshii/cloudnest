import { apiClient } from "@/app/api-client";
import {
  CreateFolderResponse,
  DeleteFilesResponse,
  DownloadFilesResponse,
  GetAllFilesResponse,
  MoveFilesResponse,
  MoveFolderResponse,
  Params,
  UploadResponse,
} from "./filesType";

export const fileApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    uploadFiles: builder.mutation<UploadResponse, FormData>({
      query: (formData) => ({
        url: "/files/upload",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["files"],
    }),

    getAllFiles: builder.query<GetAllFilesResponse, Params>({
      query: (params) => {
        const {
          keyword = undefined,
          folderId = undefined,
          provider = "S3",
          pageNumber = 1,
          pageSize = 10,
        } = params;
        return {
          url: "/files/all",
          method: "GET",
          params: {
            keyword,
            ...(folderId ? { folderId } : {}),
            provider,
            pageNumber,
            pageSize,
          },
        };
      },
      providesTags: ["files"],
    }),

    deleteFiles: builder.mutation<DeleteFilesResponse, string[]>({
      query: (fileIds) => ({
        url: `/files/bulk-delete`,
        method: "DELETE",
        body: { fileIds },
      }),
      invalidatesTags: ["files"],
    }),

    downloadFiles: builder.mutation<DownloadFilesResponse, string[]>({
      query: (fileIds) => ({
        url: `/files/download`,
        method: "POST",
        body: { fileIds },
      }),
    }),

    createFolder: builder.mutation<
      CreateFolderResponse,
      {
        name: string;
        parentId?: string | null;
        provider?: string;
        accountId?: string;
        isGoogleDriveLive?: boolean;
      }
    >({
      query: ({ isGoogleDriveLive, ...body }) =>
        isGoogleDriveLive
          ? {
              url: "/files/google-drive/folders",
              method: "POST",
              body,
            }
          : {
              url: "/files/folders",
              method: "POST",
              body,
            },
      invalidatesTags: ["files"],
    }),
    getGoogleDriveItems: builder.query<
      GetAllFilesResponse,
      {
        accountId: string;
        folderId?: string | null;
        keyword?: string;
        pageSize?: number;
        pageToken?: string;
      }
    >({
      query: (params) => ({
        url: "/files/google-drive/items",
        method: "GET",
        params: {
          accountId: params.accountId,
          ...(params.folderId ? { folderId: params.folderId } : {}),
          ...(params.keyword ? { keyword: params.keyword } : {}),
          ...(params.pageSize ? { pageSize: params.pageSize } : {}),
          ...(params.pageToken ? { pageToken: params.pageToken } : {}),
        },
      }),
      providesTags: ["files"],
    }),
    moveFiles: builder.mutation<
      MoveFilesResponse,
      {
        fileIds: string[];
        targetFolderId?: string | null;
        provider?: string;
      }
    >({
      query: (body) => ({
        url: "/files/move",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["files"],
    }),
    moveFolder: builder.mutation<
      MoveFolderResponse,
      {
        folderId: string;
        targetFolderId?: string | null;
        provider?: string;
      }
    >({
      query: ({ folderId, ...body }) => ({
        url: `/files/folders/${folderId}/move`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["files"],
    }),
    deleteFolder: builder.mutation<
      { message: string; deletedCount: number },
      { folderId: string; provider?: string }
    >({
      query: ({ folderId, provider }) => ({
        url: `/files/folders/${folderId}`,
        method: "DELETE",
        params: { provider },
      }),
      invalidatesTags: ["files"],
    }),
    moveGoogleDriveItem: builder.mutation<
      { message: string },
      {
        accountId: string;
        itemId: string;
        targetFolderId?: string | null;
      }
    >({
      query: ({ itemId, accountId, targetFolderId }) => ({
        url: `/files/google-drive/items/${encodeURIComponent(itemId)}/move`,
        method: "PATCH",
        body: { accountId, targetFolderId },
      }),
      invalidatesTags: ["files"],
    }),
    deleteGoogleDriveItem: builder.mutation<
      { message: string; deletedCount: number },
      { accountId: string; itemId: string }
    >({
      query: ({ accountId, itemId }) => ({
        url: `/files/google-drive/items/${encodeURIComponent(itemId)}`,
        method: "DELETE",
        params: { accountId },
      }),
      invalidatesTags: ["files"],
    }),
  }),
});

export const {
  useUploadFilesMutation,
  useGetAllFilesQuery,
  useDeleteFilesMutation,
  useDownloadFilesMutation,
  useCreateFolderMutation,
  useGetGoogleDriveItemsQuery,
  useMoveFilesMutation,
  useMoveFolderMutation,
  useDeleteFolderMutation,
  useMoveGoogleDriveItemMutation,
  useDeleteGoogleDriveItemMutation,
} = fileApi;
