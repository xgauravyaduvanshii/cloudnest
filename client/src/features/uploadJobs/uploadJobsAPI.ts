import { apiClient } from "@/app/api-client";
import {
  ListUploadJobsResponse,
  UploadJobDetailResponse,
  UploadJobResponse,
} from "./uploadJobsType";

export interface CreateUploadJobInput {
  formData: FormData;
}

export const uploadJobsApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    createUploadJob: builder.mutation<UploadJobResponse, FormData>({
      query: (formData) => ({
        url: "/upload-jobs",
        method: "POST",
        body: formData,
      }),
      invalidatesTags: ["uploadJobs"],
    }),

    listUploadJobs: builder.query<
      ListUploadJobsResponse,
      { pageNumber?: number; pageSize?: number }
    >({
      query: (params) => ({
        url: "/upload-jobs",
        method: "GET",
        params: {
          pageNumber: params?.pageNumber ?? 1,
          pageSize: params?.pageSize ?? 20,
        },
      }),
      providesTags: ["uploadJobs"],
    }),

    getUploadJob: builder.query<UploadJobDetailResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}`,
        method: "GET",
      }),
      providesTags: (_r, _e, jobId) => [{ type: "uploadJobs", id: jobId }],
    }),

    getUploadJobProgress: builder.query<UploadJobResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}/progress`,
        method: "GET",
      }),
      providesTags: (_r, _e, jobId) => [{ type: "uploadJobs", id: jobId }],
    }),

    pauseUploadJob: builder.mutation<UploadJobResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}/pause`,
        method: "POST",
      }),
      invalidatesTags: ["uploadJobs"],
    }),

    resumeUploadJob: builder.mutation<UploadJobResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}/resume`,
        method: "POST",
      }),
      invalidatesTags: ["uploadJobs"],
    }),

    cancelUploadJob: builder.mutation<UploadJobResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}/cancel`,
        method: "POST",
      }),
      invalidatesTags: ["uploadJobs"],
    }),

    retryUploadJob: builder.mutation<UploadJobResponse, string>({
      query: (jobId) => ({
        url: `/upload-jobs/${jobId}/retry`,
        method: "POST",
      }),
      invalidatesTags: ["uploadJobs"],
    }),
  }),
});

export const {
  useCreateUploadJobMutation,
  useListUploadJobsQuery,
  useGetUploadJobQuery,
  useGetUploadJobProgressQuery,
  usePauseUploadJobMutation,
  useResumeUploadJobMutation,
  useCancelUploadJobMutation,
  useRetryUploadJobMutation,
} = uploadJobsApi;
