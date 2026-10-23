import { Router } from 'express';
import { getLeadsReport, getMessagesReport, getBroadcastsReport } from './reports.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/leads', authenticate, getLeadsReport);
router.get('/messages', authenticate, getMessagesReport);
router.get('/broadcasts', authenticate, getBroadcastsReport);

export const reportsRouter = router;
