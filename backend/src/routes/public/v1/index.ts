import { Router } from 'express';
import fileV1Routes from './files.route';
import uploadJobsV1Routes from './upload-jobs.route';
import { apiKeyAuthMiddleware } from '../../../middlewares/apikey-auth.middleware';

const v1Routes = Router();

v1Routes.use('/files', apiKeyAuthMiddleware, fileV1Routes);
v1Routes.use('/upload-jobs', apiKeyAuthMiddleware, uploadJobsV1Routes);

export default v1Routes;
