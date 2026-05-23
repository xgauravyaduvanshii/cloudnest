import { Router } from 'express';
import { multiUpload } from '../../../config/multer.config';
import { CheckStorageAvailability } from '../../../middlewares/check-storage.middleware';
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

fileV1Routes.get('/', getApiFilesController);

fileV1Routes.post(
  '/upload',
  multiUpload,
  CheckStorageAvailability,
  uploadFilesViaApiController,
);

fileV1Routes.post('/download', downloadFilesController);
fileV1Routes.delete('/bulk-delete', deleteFilesController);
fileV1Routes.get('/:fileId', getApiFileController);
fileV1Routes.get('/:fileId/preview', getApiFilePreviewController);
fileV1Routes.get('/:fileId/download', getApiFileDownloadController);
fileV1Routes.delete('/:fileId', deleteApiFileController);

export default fileV1Routes;
