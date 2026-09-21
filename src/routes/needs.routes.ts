import { Router } from 'express';
import {
  submitNeed,
  renderModerationPage,
  executeModerationAction,
  getNeedDetails,
  getAllNeeds,
  handleAllNeedsSSE
} from '../controllers/needs.controller';
import { submitUpload } from '../middleware/upload.middleware';

const router = Router();

router.get('/', getAllNeeds);
router.post('/submit', submitUpload, submitNeed);
router.get('/stream', handleAllNeedsSSE);
router.get('/moderate', renderModerationPage);
router.post('/moderate', executeModerationAction);
router.get('/:id', getNeedDetails);

export default router;