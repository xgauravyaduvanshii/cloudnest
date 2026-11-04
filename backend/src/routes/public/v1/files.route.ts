import { Router } from 'express';
import { multiUpload } from '../../../config/multer.config';
import { CheckStorageAvailability } from '../../../middlewares/check-storage.middleware';
import { requireScopes } from '../../../middlewares/require-scope.middleware';
import { SCOPE } from '../../../constant/scopes';
import {
  deleteApiFileController,
  deleteFilesController,
  downloadFilesController,
  getApiFileController,
  getApiFileDownloadController,
  getApiFilePreviewController,
  getApiFilesController,
  uploadFilesViaApiController,
} from '../../../controllers/files.controller';

const fileV1Routes = Router();

fileV1Routes.get('/', requireScopes(SCOPE.FILES_READ), getApiFilesController);

fileV1Routes.post(
  '/upload',
  requireScopes(SCOPE.FILES_WRITE),
  multiUpload,
  CheckStorageAvailability,
  uploadFilesViaApiController,
);

fileV1Routes.post('/download', requireScopes(SCOPE.FILES_READ), downloadFilesController);
fileV1Routes.delete('/bulk-delete', requireScopes(SCOPE.FILES_WRITE), deleteFilesController);
fileV1Routes.get('/:fileId', requireScopes(SCOPE.FILES_READ), getApiFileController);
fileV1Routes.get('/:fileId/preview', requireScopes(SCOPE.FILES_READ), getApiFilePreviewController);
fileV1Routes.get('/:fileId/download', requireScopes(SCOPE.FILES_READ), getApiFileDownloadController);
fileV1Routes.delete('/:fileId', requireScopes(SCOPE.FILES_WRITE), deleteApiFileController);

export default fileV1Routes;
