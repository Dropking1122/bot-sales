import { Router } from 'express';
import { getSettings, updateSettings, getPublicSettings, uploadLogo } from './settings.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { uploadImage } from '../../middleware/upload';
import { AdminRole } from '@prisma/client';

const router = Router();

// Public branding settings for SPA / login / meta
router.get('/public', getPublicSettings);

// Protected settings routes
router.get('/', authenticate, getSettings);
router.patch('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateSettings);
router.post('/logo', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), uploadImage.single('logo'), uploadLogo);

export const settingsRouter = router;
