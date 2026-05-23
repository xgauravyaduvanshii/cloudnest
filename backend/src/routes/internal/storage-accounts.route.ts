import { Router } from 'express';
import {
  disconnectStorageAccountController,
  getEnabledProvidersController,
  getGoogleAuthUrlController,
  getStorageAccountsController,
  startTelegramAuthController,
  syncStorageAccountController,
  verifyTelegramCodeController,
  verifyTelegramPasswordController,
} from '../../controllers/storage-accounts.controller';

const storageAccountsRoutes = Router();

storageAccountsRoutes.get('/', getStorageAccountsController);
storageAccountsRoutes.get('/providers/enabled', getEnabledProvidersController);
storageAccountsRoutes.get('/google/auth-url', getGoogleAuthUrlController);
storageAccountsRoutes.post('/telegram/start', startTelegramAuthController);
storageAccountsRoutes.post('/telegram/verify-code', verifyTelegramCodeController);
storageAccountsRoutes.post(
  '/telegram/verify-password',
  verifyTelegramPasswordController,
);
storageAccountsRoutes.post('/:id/sync', syncStorageAccountController);
storageAccountsRoutes.delete('/:id', disconnectStorageAccountController);

export default storageAccountsRoutes;
