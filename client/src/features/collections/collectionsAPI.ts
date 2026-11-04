import { apiClient } from "@/app/api-client";
import {
  CollectionResponse,
  CreateCollectionInput,
  ListCollectionsResponse,
} from "./collectionsType";

type IdArg = { collectionId: string };
type ItemsArg = { collectionId: string; fileIds: string[] };

export const collectionsApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    listCollections: builder.query<ListCollectionsResponse, void>({
      query: () => ({ url: "/collections", method: "GET" }),
      providesTags: ["collections"],
    }),
    getCollection: builder.query<CollectionResponse, string>({
      query: (collectionId) => ({ url: `/collections/${collectionId}`, method: "GET" }),
      providesTags: (_r, _e, id) => [{ type: "collections", id }],
    }),
    createCollection: builder.mutation<CollectionResponse, CreateCollectionInput>({
      query: (body) => ({ url: "/collections", method: "POST", body }),
      invalidatesTags: ["collections"],
    }),
    updateCollection: builder.mutation<
      CollectionResponse,
      IdArg & Partial<CreateCollectionInput>
    >({
      query: ({ collectionId, ...body }) => ({
        url: `/collections/${collectionId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["collections"],
    }),
    deleteCollection: builder.mutation<{ message: string }, string>({
      query: (collectionId) => ({
        url: `/collections/${collectionId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["collections"],
    }),
    addFilesToCollection: builder.mutation<CollectionResponse, ItemsArg>({
      query: ({ collectionId, fileIds }) => ({
        url: `/collections/${collectionId}/items`,
        method: "POST",
        body: { fileIds },
      }),
      invalidatesTags: ["collections"],
    }),
    removeFilesFromCollection: builder.mutation<CollectionResponse, ItemsArg>({
      query: ({ collectionId, fileIds }) => ({
        url: `/collections/${collectionId}/items`,
        method: "DELETE",
        body: { fileIds },
      }),
      invalidatesTags: ["collections"],
    }),
  }),
});

export const {
  useListCollectionsQuery,
  useGetCollectionQuery,
  useLazyGetCollectionQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
  useAddFilesToCollectionMutation,
  useRemoveFilesFromCollectionMutation,
} = collectionsApi;
