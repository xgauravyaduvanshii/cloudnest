import { Router } from 'express';
import {
  addFilesToCollectionController,
  createCollectionController,
  deleteCollectionController,
  getCollectionController,
  listCollectionsController,
  removeFilesFromCollectionController,
  updateCollectionController,
} from '../../controllers/collections.controller';

const collectionsRoutes = Router();

collectionsRoutes.get('/', listCollectionsController);
collectionsRoutes.post('/', createCollectionController);
collectionsRoutes.get('/:collectionId', getCollectionController);
collectionsRoutes.patch('/:collectionId', updateCollectionController);
collectionsRoutes.delete('/:collectionId', deleteCollectionController);
collectionsRoutes.post('/:collectionId/items', addFilesToCollectionController);
collectionsRoutes.delete('/:collectionId/items', removeFilesFromCollectionController);

export default collectionsRoutes;
