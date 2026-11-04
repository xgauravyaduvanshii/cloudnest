import { Router } from 'express';
import {
  adminApiKeysController,
  adminCreateApiKeyController,
  adminDashboardController,
  adminDeleteApiKeyController,
  adminDeleteAiModelController,
  adminDeleteFilesController,
  adminDisconnectStorageAccountController,
  adminDownloadFilesController,
  adminFetchAiModelsController,
  adminFilesController,
  adminProviderSettingsController,
  adminAiModelsController,
  adminAiSettingsController,
  adminSetAiModelEnabledController,
  adminUpdateAiSettingsController,
  adminRemoveStorageAccountController,
  adminStorageAccountsController,
  adminSyncStorageAccountController,
  adminUpdateProviderSettingsController,
  adminUpdateStorageAccountStatusController,
  adminUpdateUserController,
  adminUsersController,
} from '../../controllers/admin.controller';

const adminRoutes = Router();

adminRoutes.get('/dashboard', adminDashboardController);
adminRoutes.get('/users', adminUsersController);
adminRoutes.patch('/users/:id', adminUpdateUserController);

adminRoutes.get('/files', adminFilesController);
adminRoutes.post('/files/download', adminDownloadFilesController);
adminRoutes.delete('/files/bulk-delete', adminDeleteFilesController);

adminRoutes.get('/storage-accounts', adminStorageAccountsController);
adminRoutes.patch(
  '/storage-accounts/:id/status',
  adminUpdateStorageAccountStatusController,
);
adminRoutes.post('/storage-accounts/:id/sync', adminSyncStorageAccountController);
adminRoutes.post(
  '/storage-accounts/:id/disconnect',
  adminDisconnectStorageAccountController,
);
adminRoutes.delete('/storage-accounts/:id', adminRemoveStorageAccountController);

adminRoutes.get('/api-keys', adminApiKeysController);
adminRoutes.post('/api-keys', adminCreateApiKeyController);
adminRoutes.delete('/api-keys/:id', adminDeleteApiKeyController);

adminRoutes.get('/provider-settings', adminProviderSettingsController);
adminRoutes.put(
  '/provider-settings/:provider',
  adminUpdateProviderSettingsController,
);

adminRoutes.get('/ai-settings', adminAiSettingsController);
adminRoutes.put('/ai-settings', adminUpdateAiSettingsController);
adminRoutes.post('/ai-settings/fetch-models', adminFetchAiModelsController);
adminRoutes.get('/ai-models', adminAiModelsController);
adminRoutes.patch('/ai-models/:id', adminSetAiModelEnabledController);
adminRoutes.delete('/ai-models/:id', adminDeleteAiModelController);

export default adminRoutes;
