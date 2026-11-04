import { Router } from 'express';
import {
  createShareController,
  getShareAuditController,
  listSharesController,
  listSharesForResourceController,
  revokeShareController,
  updateShareController,
} from '../../controllers/shares.controller';

const sharesRoutes = Router();

sharesRoutes.get('/', listSharesController);
sharesRoutes.post('/', createShareController);
sharesRoutes.get(
  '/resource/:resourceType/:resourceId',
  listSharesForResourceController,
);
sharesRoutes.patch('/:shareId', updateShareController);
sharesRoutes.delete('/:shareId', revokeShareController);
sharesRoutes.get('/:shareId/audit', getShareAuditController);

export default sharesRoutes;
