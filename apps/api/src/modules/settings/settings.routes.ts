import { Router } from 'express';
import { getSettings, updateSettings } from './settings.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, getSettings);
router.patch('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateSettings);

export const settingsRouter = router;
