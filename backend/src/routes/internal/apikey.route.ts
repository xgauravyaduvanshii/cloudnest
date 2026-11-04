import { Router } from 'express';
import {
  createApiKeyController,
  deleteApiKeyController,
  getAllApiKeysController,
  revokeApiKeyController,
  rotateApiKeyController,
} from '../../controllers/apikey.controller';

const apikeyRoutes = Router();

apikeyRoutes.post('/create', createApiKeyController);
apikeyRoutes.get('/all', getAllApiKeysController);
apikeyRoutes.post('/:id/revoke', revokeApiKeyController);
apikeyRoutes.post('/:id/rotate', rotateApiKeyController);
apikeyRoutes.delete('/:id', deleteApiKeyController);

export default apikeyRoutes;
