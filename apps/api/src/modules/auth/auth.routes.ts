import { Router } from 'express';
import {
  login,
  passkeyLogin,
  me,
  changePassword,
  listAdmins,
  createAdmin,
  updateAdmin
} from './auth.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.post('/login', login);
router.post('/passkey', passkeyLogin);
router.post('/logout', (_req, res) => res.json({ success: true, message: 'Logout berhasil' }));

// Protected
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

// Super Admin Only
router.get('/admins', authenticate, requireRoles(AdminRole.SUPER_ADMIN), listAdmins);
router.post('/admins', authenticate, requireRoles(AdminRole.SUPER_ADMIN), createAdmin);
router.patch('/admins/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN), updateAdmin);

export const authRouter = router;
