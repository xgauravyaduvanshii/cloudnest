import { Router } from 'express';
import { multiUploadDisk } from '../../../config/multer.config';
import { CheckStorageAvailability } from '../../../middlewares/check-storage.middleware';
import { requireScopes } from '../../../middlewares/require-scope.middleware';
import { SCOPE } from '../../../constant/scopes';
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
  requireScopes(SCOPE.UPLOAD_WRITE),
  multiUploadDisk,
  CheckStorageAvailability,
  createUploadJobApiController,
);
uploadJobsV1Routes.get('/', requireScopes(SCOPE.FILES_READ), listUploadJobsController);
uploadJobsV1Routes.get('/:jobId', requireScopes(SCOPE.FILES_READ), getUploadJobController);
uploadJobsV1Routes.get('/:jobId/progress', requireScopes(SCOPE.FILES_READ), getUploadJobProgressController);
uploadJobsV1Routes.post('/:jobId/pause', requireScopes(SCOPE.UPLOAD_WRITE), pauseUploadJobController);
uploadJobsV1Routes.post('/:jobId/resume', requireScopes(SCOPE.UPLOAD_WRITE), resumeUploadJobController);
uploadJobsV1Routes.post('/:jobId/cancel', requireScopes(SCOPE.UPLOAD_WRITE), cancelUploadJobController);
uploadJobsV1Routes.post('/:jobId/retry', requireScopes(SCOPE.UPLOAD_WRITE), retryUploadJobController);

export default uploadJobsV1Routes;
