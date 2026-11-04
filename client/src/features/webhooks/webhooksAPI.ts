import { apiClient } from "@/app/api-client";
import {
  CreateWebhookInput,
  CreateWebhookResponse,
  DeleteWebhookResponse,
  ListDeliveriesResponse,
  ListWebhookEventsResponse,
  ListWebhooksResponse,
  UpdateWebhookInput,
  UpdateWebhookResponse,
} from "./webhooksType";

export const webhooksApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    listWebhookEvents: builder.query<ListWebhookEventsResponse, void>({
      query: () => ({ url: "/webhooks/events", method: "GET" }),
    }),

    listWebhooks: builder.query<ListWebhooksResponse, void>({
      query: () => ({ url: "/webhooks", method: "GET" }),
      providesTags: ["webhooks"],
    }),

    createWebhook: builder.mutation<CreateWebhookResponse, CreateWebhookInput>({
      query: (body) => ({ url: "/webhooks", method: "POST", body }),
      invalidatesTags: ["webhooks"],
    }),

    updateWebhook: builder.mutation<UpdateWebhookResponse, UpdateWebhookInput>({
      query: ({ id, ...body }) => ({
        url: `/webhooks/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["webhooks"],
    }),

    deleteWebhook: builder.mutation<DeleteWebhookResponse, string>({
      query: (id) => ({ url: `/webhooks/${id}`, method: "DELETE" }),
      invalidatesTags: ["webhooks"],
    }),

    listWebhookDeliveries: builder.query<ListDeliveriesResponse, string>({
      query: (id) => ({ url: `/webhooks/${id}/deliveries`, method: "GET" }),
      providesTags: ["webhooks"],
    }),
  }),
});

export const {
  useListWebhookEventsQuery,
  useListWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useListWebhookDeliveriesQuery,
} = webhooksApi;
