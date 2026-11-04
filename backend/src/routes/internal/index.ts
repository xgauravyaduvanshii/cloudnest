import { Router } from 'express';
import authRoutes from './auth.route';
import filesRoutes from './files.route';
import uploadJobsRoutes from './upload-jobs.route';
import { passportAuthenticateJwt } from '../../config/passport.config';
import analyticsRoutes from './analytics.route';
import apikeyRoutes from './apikey.route';
import storageAccountsRoutes from './storage-accounts.route';
import { googleCallbackController } from '../../controllers/storage-accounts.controller';
import adminRoutes from './admin.route';
import { adminAuthMiddleware } from '../../middlewares/admin-auth.middleware';

const internalRoutes = Router();

internalRoutes.use('/auth', authRoutes);
internalRoutes.get('/storage-accounts/google/callback', googleCallbackController);
internalRoutes.use('/files', passportAuthenticateJwt, filesRoutes);
internalRoutes.use('/upload-jobs', passportAuthenticateJwt, uploadJobsRoutes);
internalRoutes.use('/analytics', passportAuthenticateJwt, analyticsRoutes);
internalRoutes.use(
  '/storage-accounts',
  passportAuthenticateJwt,
  storageAccountsRoutes,
);
internalRoutes.use(
  '/admin',
  passportAuthenticateJwt,
  adminAuthMiddleware,
  adminRoutes,
);

internalRoutes.use('/apikey', passportAuthenticateJwt, apikeyRoutes);

export default internalRoutes;
