import { Router } from 'express';
import { getDashboardSummary, getNotifications, markNotificationsRead } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/summary', authenticate, getDashboardSummary);
router.get('/notifications', authenticate, getNotifications);
router.patch('/notifications/read', authenticate, markNotificationsRead);

export const dashboardRouter = router;

