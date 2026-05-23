import { apiClient } from "@/app/api-client";
import {
  AdminApiKeysResponse,
  AdminDashboardResponse,
  AdminFilesResponse,
  AdminProviderSettingsResponse,
  AdminStorageAccountsResponse,
  AdminStorageStatusPayload,
  AdminUsersResponse,
} from "./adminType";
import { StorageAccount } from "../storageAccounts/storageAccountsType";

export const adminApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getAdminDashboard: builder.query<AdminDashboardResponse, void>({
      query: () => ({ url: "/admin/dashboard", method: "GET" }),
      providesTags: ["admin"],
    }),
    getAdminUsers: builder.query<AdminUsersResponse, { keyword?: string } | undefined>({
      query: (params) => ({
        url: "/admin/users",
        method: "GET",
        params: params || {},
      }),
      providesTags: ["admin"],
    }),
    updateAdminUser: builder.mutation<
      { message: string },
      { id: string; role?: "USER" | "ADMIN"; status?: "ACTIVE" | "DISABLED"; storageQuota?: number }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/users/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["admin"],
    }),
    getAdminFiles: builder.query<AdminFilesResponse, { keyword?: string } | undefined>({
      query: (params) => ({
        url: "/admin/files",
        method: "GET",
        params: params || {},
      }),
      providesTags: ["admin"],
    }),
    downloadAdminFiles: builder.mutation<
      { message: string; downloadUrl: string; isZip: boolean },
      string[]
    >({
      query: (fileIds) => ({
        url: "/admin/files/download",
        method: "POST",
        body: { fileIds },
      }),
    }),
    deleteAdminFiles: builder.mutation<
      { message: string; deletedCount: number; failedCount: number },
      string[]
    >({
      query: (fileIds) => ({
        url: "/admin/files/bulk-delete",
        method: "DELETE",
        body: { fileIds },
      }),
      invalidatesTags: ["admin", "files"],
    }),
    getAdminStorageAccounts: builder.query<
      AdminStorageAccountsResponse,
      void
    >({
      query: () => ({ url: "/admin/storage-accounts", method: "GET" }),
      providesTags: ["admin", "storageAccounts"],
    }),
    updateAdminStorageStatus: builder.mutation<
      { message: string },
      AdminStorageStatusPayload
    >({
      query: ({ id, status }) => ({
        url: `/admin/storage-accounts/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      invalidatesTags: ["admin", "storageAccounts"],
    }),
    syncAdminStorageAccount: builder.mutation<{ message: string }, string>({
      query: (id) => ({
        url: `/admin/storage-accounts/${id}/sync`,
        method: "POST",
      }),
      invalidatesTags: ["admin", "storageAccounts"],
    }),
    disconnectAdminStorageAccount: builder.mutation<
      { message: string; account: StorageAccount; deleted: boolean },
      string
    >({
      query: (id) => ({
        url: `/admin/storage-accounts/${id}/disconnect`,
        method: "POST",
      }),
      invalidatesTags: ["admin", "storageAccounts", "files"],
    }),
    removeAdminStorageAccount: builder.mutation<
      { message: string; account: StorageAccount; deletedCount: number },
      string
    >({
      query: (id) => ({
        url: `/admin/storage-accounts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["admin", "storageAccounts", "files"],
    }),
    getAdminApiKeys: builder.query<AdminApiKeysResponse, void>({
      query: () => ({ url: "/admin/api-keys", method: "GET" }),
      providesTags: ["admin"],
    }),
    createAdminApiKey: builder.mutation<
      { message: string; key: string },
      { userId: string; name: string }
    >({
      query: (body) => ({ url: "/admin/api-keys", method: "POST", body }),
      invalidatesTags: ["admin", "apikey"],
    }),
    deleteAdminApiKey: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/api-keys/${id}`, method: "DELETE" }),
      invalidatesTags: ["admin", "apikey"],
    }),
    getAdminProviderSettings: builder.query<AdminProviderSettingsResponse, void>({
      query: () => ({ url: "/admin/provider-settings", method: "GET" }),
      providesTags: ["admin"],
    }),
    updateAdminProviderSettings: builder.mutation<
      { message: string },
      { provider: string; config?: Record<string, unknown>; isEnabled?: boolean }
    >({
      query: ({ provider, config = {}, isEnabled }) => ({
        url: `/admin/provider-settings/${provider}`,
        method: "PUT",
        body: {
          ...config,
          ...(typeof isEnabled === "boolean" ? { isEnabled } : {}),
        },
      }),
      invalidatesTags: ["admin"],
    }),
  }),
});

export const {
  useGetAdminDashboardQuery,
  useGetAdminUsersQuery,
  useUpdateAdminUserMutation,
  useGetAdminFilesQuery,
  useDownloadAdminFilesMutation,
  useDeleteAdminFilesMutation,
  useGetAdminStorageAccountsQuery,
  useUpdateAdminStorageStatusMutation,
  useSyncAdminStorageAccountMutation,
  useDisconnectAdminStorageAccountMutation,
  useRemoveAdminStorageAccountMutation,
  useGetAdminApiKeysQuery,
  useCreateAdminApiKeyMutation,
  useDeleteAdminApiKeyMutation,
  useGetAdminProviderSettingsQuery,
  useUpdateAdminProviderSettingsMutation,
} = adminApi;
