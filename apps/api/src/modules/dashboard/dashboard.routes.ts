import { Router } from 'express';
import { getDashboardSummary } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/summary', authenticate, getDashboardSummary);

export const dashboardRouter = router;
