import { apiClient } from "@/app/api-client";
import {
  AdminAiModelsFetchResponse,
  AdminAiModelsResponse,
  AdminAiSettingsResponse,
  AdminAiSettingsUpdatePayload,
  AdminApiKeysResponse,
  AdminDashboardResponse,
  AdminFilesResponse,
  AdminProviderSettingsResponse,
  AdminStorageAccountsResponse,
  AdminStorageStatusPayload,
  AdminUsersResponse,
  AdminSmtpListResponse,
  AdminEmailTemplatesResponse,
  SmtpConfig,
  SmtpConfigPayload,
  EmailTemplate,
  EmailTemplatePayload,
  TemplateVars,
  BroadcastResponse,
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
    getAdminAiSettings: builder.query<AdminAiSettingsResponse, void>({
      query: () => ({ url: "/admin/ai-settings", method: "GET" }),
      providesTags: ["admin"],
    }),
    updateAdminAiSettings: builder.mutation<
      AdminAiSettingsResponse,
      AdminAiSettingsUpdatePayload
    >({
      query: (body) => ({ url: "/admin/ai-settings", method: "PUT", body }),
      invalidatesTags: ["admin", "ai"],
    }),
    fetchAdminAiModels: builder.mutation<AdminAiModelsFetchResponse, void>({
      query: () => ({ url: "/admin/ai-settings/fetch-models", method: "POST" }),
      invalidatesTags: ["admin"],
    }),
    getAdminAiModels: builder.query<AdminAiModelsResponse, void>({
      query: () => ({ url: "/admin/ai-models", method: "GET" }),
      providesTags: ["admin"],
    }),
    setAdminAiModelEnabled: builder.mutation<
      { message: string },
      { id: string; isEnabled: boolean }
    >({
      query: ({ id, isEnabled }) => ({
        url: `/admin/ai-models/${id}`,
        method: "PATCH",
        body: { isEnabled },
      }),
      invalidatesTags: ["admin", "ai"],
    }),
    deleteAdminAiModel: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/ai-models/${id}`, method: "DELETE" }),
      invalidatesTags: ["admin", "ai"],
    }),

    // ------------------------------------------------------ SMTP configuration
    getAdminSmtp: builder.query<AdminSmtpListResponse, void>({
      query: () => ({ url: "/admin/smtp", method: "GET" }),
      providesTags: ["email", "admin"],
    }),
    createAdminSmtp: builder.mutation<{ message: string; config: SmtpConfig }, SmtpConfigPayload>({
      query: (body) => ({ url: "/admin/smtp", method: "POST", body }),
      invalidatesTags: ["email", "admin"],
    }),
    updateAdminSmtp: builder.mutation<
      { message: string; config: SmtpConfig },
      { id: string } & Partial<SmtpConfigPayload>
    >({
      query: ({ id, ...body }) => ({ url: `/admin/smtp/${id}`, method: "PUT", body }),
      invalidatesTags: ["email", "admin"],
    }),
    deleteAdminSmtp: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/smtp/${id}`, method: "DELETE" }),
      invalidatesTags: ["email", "admin"],
    }),
    activateAdminSmtp: builder.mutation<{ message: string; config: SmtpConfig }, string>({
      query: (id) => ({ url: `/admin/smtp/${id}/activate`, method: "POST" }),
      invalidatesTags: ["email", "admin"],
    }),
    testAdminSmtpConnection: builder.mutation<{ message: string; ok: boolean }, string>({
      query: (id) => ({ url: `/admin/smtp/${id}/test`, method: "POST" }),
    }),
    smtpTestSend: builder.mutation<
      { message: string; sent: boolean },
      { to: string; templateKey: string; configId?: string; vars?: TemplateVars }
    >({
      query: (body) => ({ url: "/admin/smtp/test-send", method: "POST", body }),
    }),

    // --------------------------------------------------------- email templates
    getAdminEmailTemplates: builder.query<AdminEmailTemplatesResponse, void>({
      query: () => ({ url: "/admin/email-templates", method: "GET" }),
      providesTags: ["email", "admin"],
    }),
    createAdminEmailTemplate: builder.mutation<
      { message: string; template: EmailTemplate },
      EmailTemplatePayload
    >({
      query: (body) => ({ url: "/admin/email-templates", method: "POST", body }),
      invalidatesTags: ["email", "admin"],
    }),
    updateAdminEmailTemplate: builder.mutation<
      { message: string; template: EmailTemplate },
      { id: string; data: Partial<EmailTemplatePayload> }
    >({
      query: ({ id, data }) => ({
        url: `/admin/email-templates/${id}`,
        method: "PUT",
        body: data,
      }),
      invalidatesTags: ["email", "admin"],
    }),
    setEmailTemplateEnabled: builder.mutation<
      { message: string; template: EmailTemplate },
      { id: string; isEnabled: boolean }
    >({
      query: ({ id, isEnabled }) => ({
        url: `/admin/email-templates/${id}`,
        method: "PATCH",
        body: { isEnabled },
      }),
      invalidatesTags: ["email", "admin"],
    }),
    deleteAdminEmailTemplate: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/email-templates/${id}`, method: "DELETE" }),
      invalidatesTags: ["email", "admin"],
    }),
    sendTemplateTest: builder.mutation<
      { message: string; sent: boolean },
      { id: string; to: string; configId?: string; vars?: TemplateVars }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/email-templates/${id}/test`,
        method: "POST",
        body,
      }),
    }),
    broadcastEmail: builder.mutation<
      BroadcastResponse,
      { templateKey: string; audience: "ALL" | "USER" | "ADMIN"; vars?: TemplateVars }
    >({
      query: (body) => ({
        url: "/admin/email-templates/broadcast",
        method: "POST",
        body,
      }),
    }),

    // -------------------------------------------------- admin magic-link action
    sendAdminMagicLink: builder.mutation<
      { message: string; sent: boolean; expiresMinutes?: number },
      string
    >({
      query: (id) => ({
        url: `/admin/users/${id}/send-magic-link`,
        method: "POST",
      }),
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
  useGetAdminAiSettingsQuery,
  useUpdateAdminAiSettingsMutation,
  useFetchAdminAiModelsMutation,
  useGetAdminAiModelsQuery,
  useSetAdminAiModelEnabledMutation,
  useDeleteAdminAiModelMutation,
  useGetAdminSmtpQuery,
  useCreateAdminSmtpMutation,
  useUpdateAdminSmtpMutation,
  useDeleteAdminSmtpMutation,
  useActivateAdminSmtpMutation,
  useTestAdminSmtpConnectionMutation,
  useSmtpTestSendMutation,
  useGetAdminEmailTemplatesQuery,
  useCreateAdminEmailTemplateMutation,
  useUpdateAdminEmailTemplateMutation,
  useSetEmailTemplateEnabledMutation,
  useDeleteAdminEmailTemplateMutation,
  useSendTemplateTestMutation,
  useBroadcastEmailMutation,
  useSendAdminMagicLinkMutation,
} = adminApi;
