import { Router } from 'express';
import { getDashboardSummary, getNotifications } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/summary', authenticate, getDashboardSummary);
router.get('/notifications', authenticate, getNotifications);

export const dashboardRouter = router;

