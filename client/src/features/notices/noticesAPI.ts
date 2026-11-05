import { apiClient } from "@/app/api-client";
import type {
  ActiveNoticesResponse,
  AdminNoticesResponse,
  NoticeUpsertPayload,
  PublicNoticesResponse,
} from "./noticesType";

export const noticesApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    activeNotices: builder.query<ActiveNoticesResponse, void>({
      query: () => ({ url: "/notices/active", method: "GET" }),
      providesTags: ["notices"],
    }),
    publicNotices: builder.query<PublicNoticesResponse, void>({
      query: () => ({ url: "/site/notices", method: "GET" }),
      providesTags: ["notices"],
    }),
    dismissNotice: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/notices/${id}/dismiss`, method: "POST" }),
      invalidatesTags: ["notices"],
    }),
    undismissNotice: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/notices/${id}/dismiss`, method: "DELETE" }),
      invalidatesTags: ["notices"],
    }),
    adminNotices: builder.query<AdminNoticesResponse, void>({
      query: () => ({ url: "/admin/notices", method: "GET" }),
      providesTags: ["notices", "admin"],
    }),
    createNotice: builder.mutation<{ message: string }, NoticeUpsertPayload>({
      query: (body) => ({ url: "/admin/notices", method: "POST", body }),
      invalidatesTags: ["notices", "admin"],
    }),
    updateNotice: builder.mutation<
      { message: string },
      { id: string; data: NoticeUpsertPayload }
    >({
      query: ({ id, data }) => ({
        url: `/admin/notices/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["notices", "admin"],
    }),
    deleteNotice: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/notices/${id}`, method: "DELETE" }),
      invalidatesTags: ["notices", "admin"],
    }),
  }),
});

export const {
  useActiveNoticesQuery,
  usePublicNoticesQuery,
  useDismissNoticeMutation,
  useUndismissNoticeMutation,
  useAdminNoticesQuery,
  useCreateNoticeMutation,
  useUpdateNoticeMutation,
  useDeleteNoticeMutation,
} = noticesApi;
