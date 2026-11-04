import { Router } from 'express';
import { multiUploadDisk } from '../../../config/multer.config';
import { CheckStorageAvailability } from '../../../middlewares/check-storage.middleware';
import {
  cancelUploadJobController,
  createUploadJobApiController,
  getUploadJobController,
  getUploadJobProgressController,
  listUploadJobsController,
  pauseUploadJobController,
  retryUploadJobController,
  resumeUploadJobController,
} from '../../../controllers/upload-jobs.controller';

const uploadJobsV1Routes = Router();

uploadJobsV1Routes.post(
  '/',
  multiUploadDisk,
  CheckStorageAvailability,
  createUploadJobApiController,
);
uploadJobsV1Routes.get('/', listUploadJobsController);
uploadJobsV1Routes.get('/:jobId', getUploadJobController);
uploadJobsV1Routes.get('/:jobId/progress', getUploadJobProgressController);
uploadJobsV1Routes.post('/:jobId/pause', pauseUploadJobController);
uploadJobsV1Routes.post('/:jobId/resume', resumeUploadJobController);
uploadJobsV1Routes.post('/:jobId/cancel', cancelUploadJobController);
uploadJobsV1Routes.post('/:jobId/retry', retryUploadJobController);

export default uploadJobsV1Routes;
