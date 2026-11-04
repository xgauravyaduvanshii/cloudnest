import { Router } from 'express';
import {
  activityTimelineController,
  quotaAlertsController,
  storageBreakdownController,
  topFilesController,
  uploadReliabilityController,
} from '../../controllers/activity.controller';

const activityRoutes = Router();

activityRoutes.get('/timeline', activityTimelineController);
activityRoutes.get('/storage-breakdown', storageBreakdownController);
activityRoutes.get('/upload-reliability', uploadReliabilityController);
activityRoutes.get('/top-files', topFilesController);
activityRoutes.get('/quota-alerts', quotaAlertsController);

export default activityRoutes;
