import { Router } from 'express';
import {
  publicDownloadZipController,
  publicGetFileUrlController,
  publicGetGoogleDriveItemPreviewController,
} from '../../controllers/files.controller';
import { Env } from '../../config/env.config';
import v1Routes from './v1';

const publicRoutes = Router();

publicRoutes.use(`${Env.BASE_PATH}/v1`, v1Routes);

publicRoutes.get(`${Env.BASE_PATH}/files/download-zip`, publicDownloadZipController);
publicRoutes.get(
  '/files/google-drive/:accountId/:itemId/view',
  publicGetGoogleDriveItemPreviewController,
);
publicRoutes.use('/files/:fileId/view', publicGetFileUrlController);

export default publicRoutes;
