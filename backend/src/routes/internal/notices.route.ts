import { Router } from 'express';
import {
  activeNoticesController,
  dismissNoticeController,
  undismissNoticeController,
} from '../../controllers/notices.controller';

const noticesRoutes = Router();

noticesRoutes.get('/active', activeNoticesController);
noticesRoutes.post('/:id/dismiss', dismissNoticeController);
noticesRoutes.delete('/:id/dismiss', undismissNoticeController);

export default noticesRoutes;
