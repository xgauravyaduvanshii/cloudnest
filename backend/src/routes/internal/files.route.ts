import { Router } from 'express';
import { multiUpload } from '../../config/multer.config';
import {
  createFolderController,
  createGoogleDriveFolderController,
  deleteFolderController,
  deleteFilesController,
  deleteGoogleDriveItemController,
  downloadFilesController,
  getAllFilesController,
  getGoogleDriveItemsController,
  moveFilesController,
  moveFolderController,
  moveGoogleDriveItemController,
  uploadFilesViaWebController,
} from '../../controllers/files.controller';
import { CheckStorageAvailability } from '../../middlewares/check-storage.middleware';

const filesRoutes = Router();

filesRoutes.post(
  '/upload',
  multiUpload,
  CheckStorageAvailability,
  uploadFilesViaWebController,
);

filesRoutes.post('/download', downloadFilesController);
filesRoutes.get('/google-drive/items', getGoogleDriveItemsController);
filesRoutes.post('/google-drive/folders', createGoogleDriveFolderController);
filesRoutes.patch('/google-drive/items/:itemId/move', moveGoogleDriveItemController);
filesRoutes.delete('/google-drive/items/:itemId', deleteGoogleDriveItemController);
filesRoutes.post('/folders', createFolderController);
filesRoutes.patch('/folders/:folderId/move', moveFolderController);
filesRoutes.delete('/folders/:folderId', deleteFolderController);
filesRoutes.patch('/move', moveFilesController);
filesRoutes.get('/all', getAllFilesController);
filesRoutes.delete('/bulk-delete', deleteFilesController);

export default filesRoutes;
