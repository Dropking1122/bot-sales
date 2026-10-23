import { Router } from 'express';
import {
  getWhatsAppStatus,
  connectWhatsApp,
  disconnectWhatsApp,
  reconnectWhatsApp
} from './whatsapp.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/status', authenticate, getWhatsAppStatus);
router.get('/qr', authenticate, getWhatsAppStatus);
router.post('/connect', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), connectWhatsApp);
router.post('/disconnect', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), disconnectWhatsApp);
router.post('/reconnect', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), reconnectWhatsApp);

export const whatsappRouter = router;
