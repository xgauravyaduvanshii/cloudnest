import { apiClient } from "@/app/api-client";
import {
  CreateApiKeyInput,
  CreateApiKeyResponse,
  GetAllApiKeysResponse,
  Params,
} from "./apikeysType";

export const fileApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    createApiKey: builder.mutation<CreateApiKeyResponse, CreateApiKeyInput>({
      query: (body) => ({
        url: "/apikey/create",
        method: "POST",
        body,
      }),
      invalidatesTags: ["apikey"],
    }),

    getAllApikeys: builder.query<GetAllApiKeysResponse, Params>({
      query: (params) => {
        const { pageNumber = 1, pageSize = 10 } = params;
        return {
          url: "/apikey/all",
          method: "GET",
          params: {
            pageNumber,
            pageSize,
          },
        };
      },
      providesTags: ["apikey"],
    }),

    deleteApiKey: builder.mutation<void, string>({
      query: (apiKeyId) => ({
        url: `/apikey/${apiKeyId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["apikey"],
    }),

    revokeApiKey: builder.mutation<{ message: string }, string>({
      query: (apiKeyId) => ({
        url: `/apikey/${apiKeyId}/revoke`,
        method: "POST",
      }),
      invalidatesTags: ["apikey"],
    }),

    rotateApiKey: builder.mutation<CreateApiKeyResponse, string>({
      query: (apiKeyId) => ({
        url: `/apikey/${apiKeyId}/rotate`,
        method: "POST",
      }),
      invalidatesTags: ["apikey"],
    }),
  }),
});

export const {
  useCreateApiKeyMutation,
  useGetAllApikeysQuery,
  useDeleteApiKeyMutation,
  useRevokeApiKeyMutation,
  useRotateApiKeyMutation,
} = fileApi;
