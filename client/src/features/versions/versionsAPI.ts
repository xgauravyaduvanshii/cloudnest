import { apiClient } from "@/app/api-client";
import { RestoreVersionResponse, VersionHistoryResponse } from "./versionsType";

export const versionsApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    getFileVersions: builder.query<VersionHistoryResponse, string>({
      query: (fileId) => ({ url: `/files/${fileId}/versions`, method: "GET" }),
      providesTags: (_r, _e, fileId) => [{ type: "files", id: `versions-${fileId}` }],
    }),
    restoreFileVersion: builder.mutation<RestoreVersionResponse, string>({
      query: (versionFileId) => ({
        url: `/files/${versionFileId}/versions/restore`,
        method: "POST",
      }),
      invalidatesTags: ["files"],
    }),
  }),
});

export const { useGetFileVersionsQuery, useRestoreFileVersionMutation } = versionsApi;
