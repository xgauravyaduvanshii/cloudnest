import { apiClient } from "@/app/api-client";
import {
  GoogleAuthUrlResponse,
  EnabledProvidersResponse,
  StorageAccount,
  StorageAccountsResponse,
  StorageOwnerType,
  TelegramStartResponse,
  TelegramVerifyResponse,
} from "./storageAccountsType";

export const storageAccountsApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getStorageAccounts: builder.query<StorageAccountsResponse, void>({
      query: () => ({
        url: "/storage-accounts",
        method: "GET",
      }),
      providesTags: ["storageAccounts"],
    }),
    getEnabledProviders: builder.query<EnabledProvidersResponse, void>({
      query: () => ({
        url: "/storage-accounts/providers/enabled",
        method: "GET",
      }),
      providesTags: ["storageAccounts", "admin"],
    }),
    getGoogleAuthUrl: builder.query<GoogleAuthUrlResponse, StorageOwnerType | void>({
      query: (ownerType = "USER") => ({
        url: "/storage-accounts/google/auth-url",
        method: "GET",
        params: { ownerType },
      }),
    }),
    startTelegramAuth: builder.mutation<
      TelegramStartResponse,
      { phoneNumber: string; ownerType?: StorageOwnerType }
    >({
      query: (body) => ({
        url: "/storage-accounts/telegram/start",
        method: "POST",
        body,
      }),
    }),
    verifyTelegramCode: builder.mutation<
      TelegramVerifyResponse,
      { authId: string; code: string }
    >({
      query: (body) => ({
        url: "/storage-accounts/telegram/verify-code",
        method: "POST",
        body,
      }),
      invalidatesTags: ["storageAccounts"],
    }),
    verifyTelegramPassword: builder.mutation<
      TelegramVerifyResponse,
      { authId: string; password: string }
    >({
      query: (body) => ({
        url: "/storage-accounts/telegram/verify-password",
        method: "POST",
        body,
      }),
      invalidatesTags: ["storageAccounts"],
    }),
    syncStorageAccount: builder.mutation<
      { message: string; account: StorageAccount },
      string
    >({
      query: (id) => ({
        url: `/storage-accounts/${id}/sync`,
        method: "POST",
      }),
      invalidatesTags: ["storageAccounts", "analytics", "files"],
    }),
    disconnectStorageAccount: builder.mutation<
      { message: string; account: StorageAccount; deleted: boolean },
      string
    >({
      query: (id) => ({
        url: `/storage-accounts/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["storageAccounts"],
    }),
  }),
});

export const {
  useGetStorageAccountsQuery,
  useGetEnabledProvidersQuery,
  useLazyGetGoogleAuthUrlQuery,
  useStartTelegramAuthMutation,
  useVerifyTelegramCodeMutation,
  useVerifyTelegramPasswordMutation,
  useSyncStorageAccountMutation,
  useDisconnectStorageAccountMutation,
} = storageAccountsApi;
