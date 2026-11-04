import { apiClient } from "@/app/api-client";
import {
  ActivityTimelineResponse,
  QuotaAlert,
  StorageBreakdown,
  UploadReliability,
} from "./activityType";

export const activityApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    activityTimeline: builder.query<
      ActivityTimelineResponse,
      { pageSize?: number; pageNumber?: number; action?: string; entityType?: string }
    >({
      query: (params) => ({
        url: "/activity/timeline",
        method: "GET",
        params: {
          pageSize: params.pageSize ?? 20,
          pageNumber: params.pageNumber ?? 1,
          ...(params.action ? { action: params.action } : {}),
          ...(params.entityType ? { entityType: params.entityType } : {}),
        },
      }),
      providesTags: ["activity"],
    }),
    storageBreakdown: builder.query<StorageBreakdown, void>({
      query: () => ({ url: "/activity/storage-breakdown", method: "GET" }),
      providesTags: ["activity"],
    }),
    uploadReliability: builder.query<UploadReliability, void>({
      query: () => ({ url: "/activity/upload-reliability", method: "GET" }),
      providesTags: ["activity"],
    }),
    quotaAlerts: builder.query<{ alerts: QuotaAlert[] }, number | void>({
      query: (threshold) => ({
        url: "/activity/quota-alerts",
        method: "GET",
        params: typeof threshold === "number" ? { threshold } : undefined,
      }),
      providesTags: ["activity"],
    }),
  }),
});

export const {
  useActivityTimelineQuery,
  useStorageBreakdownQuery,
  useUploadReliabilityQuery,
  useQuotaAlertsQuery,
} = activityApi;
