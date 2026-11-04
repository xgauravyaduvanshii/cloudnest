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
import { openApiSpec, swaggerHtml } from '../../config/openapi.config';
import v1Routes from './v1';

const publicRoutes = Router();

// API contract + interactive docs (registered before the authed v1 mount so they
// are reachable without a key and bypass the v1 rate limiter).
publicRoutes.get(`${Env.BASE_PATH}/v1/openapi.json`, (_req, res) => {
  res.status(200).json(openApiSpec);
});
publicRoutes.get(`${Env.BASE_PATH}/docs`, (_req, res) => {
  res
    .status(200)
    .type('html')
    .send(swaggerHtml(`${Env.BASE_PATH}/v1/openapi.json`));
});

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
