import { Router } from 'express';
import { simulate, getMotorcyclePlans, createFinancingPlan } from './financing.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.post('/simulate', simulate);
router.get('/:motorcycleId/plans', authenticate, getMotorcyclePlans);
router.post('/:motorcycleId/plans', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createFinancingPlan);

export const financingRouter = router;
