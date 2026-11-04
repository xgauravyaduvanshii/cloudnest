import { Router } from 'express';
import { multiUploadDisk } from '../../config/multer.config';
import { CheckStorageAvailability } from '../../middlewares/check-storage.middleware';
import {
  cancelUploadJobController,
  createUploadJobController,
  getUploadJobController,
  getUploadJobProgressController,
  listUploadJobsController,
  pauseUploadJobController,
  retryUploadJobController,
  resumeUploadJobController,
} from '../../controllers/upload-jobs.controller';

const uploadJobsRoutes = Router();

// Create a job from a multipart upload (files stream to disk temp storage).
uploadJobsRoutes.post(
  '/',
  multiUploadDisk,
  CheckStorageAvailability,
  createUploadJobController,
);
uploadJobsRoutes.get('/', listUploadJobsController);
uploadJobsRoutes.get('/:jobId', getUploadJobController);
uploadJobsRoutes.get('/:jobId/progress', getUploadJobProgressController);
uploadJobsRoutes.post('/:jobId/pause', pauseUploadJobController);
uploadJobsRoutes.post('/:jobId/resume', resumeUploadJobController);
uploadJobsRoutes.post('/:jobId/cancel', cancelUploadJobController);
uploadJobsRoutes.post('/:jobId/retry', retryUploadJobController);

export default uploadJobsRoutes;
