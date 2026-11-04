import { apiClient } from "@/app/api-client";
import {
  AiStatusResponse,
  AssistantAction,
  AssistantApplyResponse,
  AssistantPlanResponse,
  ChatResponse,
  ConversationMessagesResponse,
  EnrichResponse,
  ListConversationsResponse,
  MetadataResponse,
  SearchResponse,
} from "./aiType";

export const aiApi = apiClient.injectEndpoints({
  endpoints: (builder) => ({
    aiStatus: builder.query<AiStatusResponse, void>({
      query: () => ({ url: "/ai/status", method: "GET" }),
    }),
    aiSearch: builder.query<SearchResponse, { query: string; limit?: number }>({
      query: ({ query, limit }) => ({
        url: "/ai/search",
        method: "GET",
        params: { query, limit },
      }),
    }),
    enrichFile: builder.mutation<EnrichResponse, { fileId: string }>({
      query: (body) => ({ url: "/ai/enrich", method: "POST", body }),
      invalidatesTags: ["ai", "activity"],
    }),
    getFileMetadata: builder.query<MetadataResponse, string>({
      query: (fileId) => ({ url: `/ai/files/${fileId}/metadata`, method: "GET" }),
      providesTags: ["ai"],
    }),
    assistantPlan: builder.mutation<AssistantPlanResponse, { instruction: string }>({
      query: (body) => ({ url: "/ai/assistant/plan", method: "POST", body }),
    }),
    assistantApply: builder.mutation<
      AssistantApplyResponse,
      { actions: AssistantAction[] }
    >({
      query: (body) => ({ url: "/ai/assistant/apply", method: "POST", body }),
      invalidatesTags: ["collections", "files", "activity"],
    }),
    chat: builder.mutation<
      ChatResponse,
      { message: string; conversationId?: string; fileIds?: string[] }
    >({
      query: (body) => ({ url: "/ai/chat", method: "POST", body }),
      invalidatesTags: ["ai"],
    }),
    listConversations: builder.query<ListConversationsResponse, void>({
      query: () => ({ url: "/ai/conversations", method: "GET" }),
      providesTags: ["ai"],
    }),
    getConversation: builder.query<ConversationMessagesResponse, string>({
      query: (conversationId) => ({
        url: `/ai/conversations/${conversationId}`,
        method: "GET",
      }),
    }),
    deleteConversation: builder.mutation<{ message: string }, string>({
      query: (conversationId) => ({
        url: `/ai/conversations/${conversationId}`,
        method: "DELETE",
      }),
      invalidatesTags: ["ai"],
    }),
  }),
});

export const {
  useAiStatusQuery,
  useLazyAiSearchQuery,
  useAiSearchQuery,
  useEnrichFileMutation,
  useGetFileMetadataQuery,
  useAssistantPlanMutation,
  useAssistantApplyMutation,
  useChatMutation,
  useListConversationsQuery,
  useGetConversationQuery,
  useDeleteConversationMutation,
} = aiApi;
