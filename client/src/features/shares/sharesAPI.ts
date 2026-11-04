import { apiClient } from "@/app/api-client";
import {
  CreateShareInput,
  ListSharesResponse,
  ResolveShareResponse,
  ShareAuditEntry,
  ShareResponse,
} from "./sharesType";

type UpdateShareArg = {
  shareId: string;
} & Partial<CreateShareInput> & { isActive?: boolean };

export const sharesApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    listShares: builder.query<ListSharesResponse, void>({
      query: () => ({ url: "/shares", method: "GET" }),
      providesTags: ["shares"],
    }),
    listSharesForResource: builder.query<
      ListSharesResponse,
      { resourceType: string; resourceId: string }
    >({
      query: ({ resourceType, resourceId }) => ({
        url: `/shares/resource/${resourceType}/${resourceId}`,
        method: "GET",
      }),
      providesTags: ["shares"],
    }),
    createShare: builder.mutation<ShareResponse, CreateShareInput>({
      query: (body) => ({ url: "/shares", method: "POST", body }),
      invalidatesTags: ["shares", "activity"],
    }),
    updateShare: builder.mutation<ShareResponse, UpdateShareArg>({
      query: ({ shareId, ...body }) => ({
        url: `/shares/${shareId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["shares"],
    }),
    revokeShare: builder.mutation<{ message: string }, string>({
      query: (shareId) => ({ url: `/shares/${shareId}`, method: "DELETE" }),
      invalidatesTags: ["shares"],
    }),
    getShareAudit: builder.query<{ audit: ShareAuditEntry[] }, string>({
      query: (shareId) => ({ url: `/shares/${shareId}/audit`, method: "GET" }),
    }),
    // Public, anonymous resolution (no auth required).
    resolveShare: builder.query<ResolveShareResponse, { token: string; password?: string }>({
      query: ({ token, password }) => ({
        url: `/share/${token}`,
        method: "GET",
        params: password ? { password } : undefined,
      }),
    }),
  }),
});

export const {
  useListSharesQuery,
  useListSharesForResourceQuery,
  useCreateShareMutation,
  useUpdateShareMutation,
  useRevokeShareMutation,
  useGetShareAuditQuery,
  useResolveShareQuery,
  useLazyResolveShareQuery,
} = sharesApi;
