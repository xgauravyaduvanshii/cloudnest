import { Router } from 'express';
import {
  aiSearchController,
  aiStatusController,
  assistantApplyController,
  assistantPlanController,
  chatController,
  deleteConversationController,
  enrichFileController,
  getConversationController,
  getFileMetadataController,
  listConversationsController,
} from '../../controllers/ai.controller';

const aiRoutes = Router();

aiRoutes.get('/status', aiStatusController);
aiRoutes.get('/search', aiSearchController);
aiRoutes.post('/enrich', enrichFileController);
aiRoutes.get('/files/:fileId/metadata', getFileMetadataController);

aiRoutes.post('/assistant/plan', assistantPlanController);
aiRoutes.post('/assistant/apply', assistantApplyController);

aiRoutes.post('/chat', chatController);
aiRoutes.get('/conversations', listConversationsController);
aiRoutes.get('/conversations/:conversationId', getConversationController);
aiRoutes.delete('/conversations/:conversationId', deleteConversationController);

export default aiRoutes;
