import { apiClient } from "@/app/api-client";
import type {
  AdminContactRequestsResponse,
  ContactStatus,
  MyContactRequestsResponse,
  SubmitContactPayload,
  SubmitContactResponse,
} from "./contactType";

export const contactApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    submitContact: builder.mutation<SubmitContactResponse, SubmitContactPayload>({
      query: (body) => ({ url: "/contact", method: "POST", body }),
      invalidatesTags: ["contact"],
    }),
    getMyContactRequests: builder.query<MyContactRequestsResponse, void>({
      query: () => ({ url: "/contact/mine", method: "GET" }),
      providesTags: ["contact"],
    }),
    getAdminContactRequests: builder.query<
      AdminContactRequestsResponse,
      { status?: ContactStatus; keyword?: string; pageSize?: number; pageNumber?: number } | void
    >({
      query: (params) => ({
        url: "/admin/contact-requests",
        method: "GET",
        params: params || {},
      }),
      providesTags: ["contact", "admin"],
    }),
    updateContactStatus: builder.mutation<
      { message: string },
      { id: string; status: ContactStatus; adminNote?: string | null }
    >({
      query: ({ id, ...body }) => ({
        url: `/admin/contact-requests/${id}/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["contact", "admin"],
    }),
    deleteContactRequest: builder.mutation<{ message: string }, string>({
      query: (id) => ({ url: `/admin/contact-requests/${id}`, method: "DELETE" }),
      invalidatesTags: ["contact", "admin"],
    }),
  }),
});

export const {
  useSubmitContactMutation,
  useGetMyContactRequestsQuery,
  useGetAdminContactRequestsQuery,
  useUpdateContactStatusMutation,
  useDeleteContactRequestMutation,
} = contactApi;
