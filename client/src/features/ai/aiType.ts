import { FileType } from "@/features/files/filesType";

export interface AiStatusResponse {
  enabled: boolean;
  provider: string;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
}

export interface AiFileMetadata {
  fileId: string;
  userId: string;
  summary: string | null;
  description: string | null;
  altText: string | null;
  tags: string[];
  categories: string[];
  colors: string[];
  language: string | null;
  hasEmbedding: boolean;
  enrichmentModel: string | null;
  enrichedAt: string | null;
}

export interface EnrichResponse {
  disabled: boolean;
  file: AiFileMetadata | null;
}

export interface MetadataResponse {
  metadata: AiFileMetadata | null;
}

export interface SearchResultItem {
  file: FileType;
  score: number;
  match: { name: boolean; keyword: boolean; semantic: number };
  ai: { summary: string | null; tags: string[]; categories: string[] } | null;
}

export interface SearchResponse {
  query: string;
  aiEnabled: boolean;
  results: SearchResultItem[];
}

export type AssistantAction =
  | { type: "create_collection"; name: string; description?: string | null }
  | { type: "add_to_collection"; collection: string; fileIds: string[] };

export interface AssistantPlanResponse {
  aiEnabled: boolean;
  requiresConfirmation: boolean;
  rationale?: string | null;
  actions: AssistantAction[];
  message?: string;
}

export interface AssistantApplyResponse {
  applied: number;
  skipped: number;
  results: Array<{
    type: string;
    ok: boolean;
    collectionId?: string;
    added?: number;
    error?: string;
  }>;
}

export interface AiCitation {
  fileId: string;
  name: string;
}

export interface ChatResponse {
  disabled: boolean;
  conversationId: string | null;
  answer: string;
  citations: AiCitation[];
  model?: string;
}

export interface AiConversation {
  _id: string;
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiMessage {
  _id: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations: AiCitation[];
  createdAt: string;
}

export interface ListConversationsResponse {
  conversations: AiConversation[];
}

export interface ConversationMessagesResponse {
  conversation: AiConversation;
  messages: AiMessage[];
}
