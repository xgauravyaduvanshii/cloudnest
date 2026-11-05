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
import { optionalAuthMiddleware } from '../../middlewares/optional-auth.middleware';
import { submitContactController } from '../../controllers/contact.controller';
import { publicNoticesController } from '../../controllers/notices.controller';
import v1Routes from './v1';

const publicRoutes = Router();

// Public contact form. Optional bearer token links the submission to a signed-in
// user so it also appears in their dashboard; anonymous submissions still work.
publicRoutes.post(
  `${Env.BASE_PATH}/contact`,
  optionalAuthMiddleware,
  submitContactController,
);
// Public (unauthenticated) notices for the marketing announcement bar. Uses a
// distinct path because the internal router mounts a JWT-guarded handler on the
// entire `/notices` prefix first, which would otherwise 401 this public route.
publicRoutes.get(`${Env.BASE_PATH}/site/notices`, publicNoticesController);

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
