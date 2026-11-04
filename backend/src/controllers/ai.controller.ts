import { Request, Response } from 'express';
import { asyncHandler } from '../middlewares/asyncHander.middleware';
import { HTTPSTATUS } from '../config/http.config';
import { enrichFileService, getAiStatusService, getFileMetadataService } from '../services/ai.service';
import { smartSearchService } from '../services/ai-search.service';
import { applyAssistantService, planAssistantService } from '../services/ai-assistant.service';
import {
  askChatService,
  deleteConversationService,
  getConversationMessagesService,
  listConversationsService,
} from '../services/ai-chat.service';
import {
  assistantApplySchema,
  assistantPlanSchema,
  chatSchema,
  conversationIdSchema,
  enrichSchema,
  fileIdSchema,
  searchSchema,
} from '../validators/ai.validator';
import { listEnabledChatModelsService } from '../services/admin-ai.service';

export const aiStatusController = asyncHandler(async (_req: Request, res: Response) => {
  return res.status(HTTPSTATUS.OK).json(await getAiStatusService());
});

export const aiModelsController = asyncHandler(async (_req: Request, res: Response) => {
  const result = await listEnabledChatModelsService();
  return res.status(HTTPSTATUS.OK).json(result);
});

export const enrichFileController = asyncHandler(async (req: Request, res: Response) => {
  const { fileId } = enrichSchema.parse(req.body);
  const result = await enrichFileService(req.user?._id, fileId);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const getFileMetadataController = asyncHandler(async (req: Request, res: Response) => {
  const fileId = fileIdSchema.parse(req.params.fileId);
  const metadata = await getFileMetadataService(req.user?._id, fileId);
  return res.status(HTTPSTATUS.OK).json({ metadata });
});

export const aiSearchController = asyncHandler(async (req: Request, res: Response) => {
  const { query, limit } = searchSchema.parse({
    query: req.query.query,
    limit: req.query.limit,
  });
  const result = await smartSearchService(req.user?._id, query, limit);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const assistantPlanController = asyncHandler(async (req: Request, res: Response) => {
  const payload = assistantPlanSchema.parse(req.body);
  const plan = await planAssistantService(req.user?._id, payload);
  return res.status(HTTPSTATUS.OK).json(plan);
});

export const assistantApplyController = asyncHandler(async (req: Request, res: Response) => {
  const { actions } = assistantApplySchema.parse(req.body);
  const result = await applyAssistantService(req.user?._id, actions);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const chatController = asyncHandler(async (req: Request, res: Response) => {
  const payload = chatSchema.parse(req.body);
  const result = await askChatService(req.user?._id, payload);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const listConversationsController = asyncHandler(async (req: Request, res: Response) => {
  const conversations = await listConversationsService(req.user?._id);
  return res.status(HTTPSTATUS.OK).json({ conversations });
});

export const getConversationController = asyncHandler(async (req: Request, res: Response) => {
  const conversationId = conversationIdSchema.parse(req.params.conversationId);
  const result = await getConversationMessagesService(req.user?._id, conversationId);
  return res.status(HTTPSTATUS.OK).json(result);
});

export const deleteConversationController = asyncHandler(async (req: Request, res: Response) => {
  const conversationId = conversationIdSchema.parse(req.params.conversationId);
  await deleteConversationService(req.user?._id, conversationId);
  return res.status(HTTPSTATUS.OK).json({ message: 'Conversation deleted' });
});
