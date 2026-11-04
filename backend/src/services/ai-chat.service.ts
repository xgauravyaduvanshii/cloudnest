import AiConversationModel, { AiCitation } from '../models/ai-conversation.model';
import AiMetadataModel from '../models/ai-metadata.model';
import FileModel from '../models/file.model';
import { getAiProvider, isAiConfigured } from '../providers/ai';
import type { AiChatMessage } from '../providers/ai/ai-provider';
import { NotFoundException, UnauthorizedException } from '../utils/app-error';
import { smartSearchService } from './ai-search.service';

const MAX_CONTEXT_FILES = 5;
const MAX_CHARS_PER_FILE = 4000;

export const listConversationsService = async (userId: string | undefined, limit = 30) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  return AiConversationModel.listForUser(userId, limit);
};

export const getConversationMessagesService = async (userId: string | undefined, conversationId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const conversation = await AiConversationModel.findByIdForUser(conversationId, userId);
  if (!conversation) throw new NotFoundException('Conversation not found');
  const messages = await AiConversationModel.listMessages(conversationId);
  return { conversation, messages };
};

export const deleteConversationService = async (userId: string | undefined, conversationId: string) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const deleted = await AiConversationModel.deleteForUser(conversationId, userId);
  if (!deleted) throw new NotFoundException('Conversation not found');
  return { deleted: true };
};

/**
 * Retrieval-augmented document chat. Only the user's own files are retrieved and
 * only the (server-side) AI key is ever used; the answer cites the files it drew from.
 */
export const askChatService = async (
  userId: string | undefined,
  input: { message: string; conversationId?: string; fileIds?: string[] },
) => {
  if (!userId) throw new UnauthorizedException('Unauthorized access');
  const message = (input.message || '').trim();
  if (!message) throw new UnauthorizedException('Message is required');

  if (!isAiConfigured()) {
    return {
      disabled: true,
      answer: 'AI is not configured on this server, so document chat is unavailable.',
      citations: [] as AiCitation[],
      conversationId: input.conversationId ?? null,
    };
  }

  const provider = getAiProvider();

  // Resolve or create the conversation.
  let conversation = input.conversationId
    ? await AiConversationModel.findByIdForUser(input.conversationId, userId)
    : null;
  if (input.conversationId && !conversation) throw new NotFoundException('Conversation not found');
  if (!conversation) {
    conversation = await AiConversationModel.create(userId, message.slice(0, 80));
  }

  // Retrieve context files (explicit selection, otherwise a smart-search of the question).
  let contextFileIds: string[] = [];
  if (input.fileIds?.length) {
    const owned = await FileModel.findByIdsForUser(input.fileIds, userId);
    contextFileIds = owned.map((f) => f._id);
  } else {
    const search = await smartSearchService(userId, message, MAX_CONTEXT_FILES);
    contextFileIds = search.results.slice(0, MAX_CONTEXT_FILES).map((r) => r.file._id);
  }

  const contextFiles = contextFileIds.length
    ? await FileModel.findByIdsForUser(contextFileIds, userId)
    : [];

  const citations: AiCitation[] = contextFiles.map((f) => ({ fileId: f._id, name: f.originalName }));

  const contextBlocks: string[] = [];
  for (const file of contextFiles) {
    const meta = await AiMetadataModel.findByFileId(file._id);
    const body =
      meta?.extractedText || meta?.summary || meta?.description || `(no extracted text for ${file.mimeType})`;
    contextBlocks.push(`### ${file.originalName} (${file.mimeType})\n${body.slice(0, MAX_CHARS_PER_FILE)}`);
  }

  // Load recent history for conversational continuity.
  const history = await AiConversationModel.listMessages(conversation._id);
  const historyMessages: AiChatMessage[] = history.slice(-10).map((m) => ({
    role: m.role === 'system' ? 'system' : m.role,
    content: m.content,
  }));

  const chatMessages: AiChatMessage[] = [
    {
      role: 'system',
      content:
        'You answer questions using ONLY the provided file excerpts from the user\'s cloud storage. ' +
        'Cite files by name. If the answer is not supported by the excerpts, say so. Be concise.\n\n' +
        (contextBlocks.length ? contextBlocks.join('\n\n') : 'No files were retrieved for this question.'),
    },
    ...historyMessages,
    { role: 'user', content: message },
  ];

  const chat = await provider.chat({ messages: chatMessages, maxTokens: 800 });

  await AiConversationModel.addMessage({ conversationId: conversation._id, role: 'user', content: message });
  await AiConversationModel.addMessage({
    conversationId: conversation._id,
    role: 'assistant',
    content: chat.text,
    citations,
  });
  await AiConversationModel.touch(conversation._id);

  return {
    disabled: false,
    conversationId: conversation._id,
    answer: chat.text,
    citations,
    model: chat.model,
  };
};
