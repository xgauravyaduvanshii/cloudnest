import { Router } from 'express';
import {
  publicDownloadZipController,
  publicGetFileUrlController,
  publicGetGoogleDriveItemPreviewController,
} from '../../controllers/files.controller';
import {
  publicDownloadShareFileController,
  publicResolveShareController,
} from '../../controllers/shares.controller';
import { Env } from '../../config/env.config';
import v1Routes from './v1';

const publicRoutes = Router();

publicRoutes.use(`${Env.BASE_PATH}/v1`, v1Routes);

// Anonymous share access (expiry/password/download-limit enforced in the service).
publicRoutes.get(`${Env.BASE_PATH}/share/:token`, publicResolveShareController);
publicRoutes.get(`${Env.BASE_PATH}/share/:token/files/:fileId`, publicDownloadShareFileController);

publicRoutes.get(`${Env.BASE_PATH}/files/download-zip`, publicDownloadZipController);
publicRoutes.get(
  '/files/google-drive/:accountId/:itemId/view',
  publicGetGoogleDriveItemPreviewController,
);
publicRoutes.use('/files/:fileId/view', publicGetFileUrlController);

export default publicRoutes;
