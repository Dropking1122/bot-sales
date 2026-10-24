import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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

// Rate limiter for authentication attempts (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 60, // maksimal 60 percobaan per 15 menit per IP
  message: {
    success: false,
    message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu beberapa saat sebelum mencoba kembali.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', authLimiter, login);
router.post('/passkey', authLimiter, passkeyLogin);
router.post('/logout', (_req, res) => res.json({ success: true, message: 'Logout berhasil' }));

// Protected
router.get('/me', authenticate, me);
router.post('/change-password', authenticate, changePassword);

// Super Admin Only
router.get('/admins', authenticate, requireRoles(AdminRole.SUPER_ADMIN), listAdmins);
router.post('/admins', authenticate, requireRoles(AdminRole.SUPER_ADMIN), createAdmin);
router.patch('/admins/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN), updateAdmin);

export const authRouter = router;
