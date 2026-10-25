import { Router } from 'express';
import { getSettings, updateSettings, getPublicSettings, uploadLogo, getCategories, addCategory, deleteCategory, testAiEndpoint } from './settings.controller';
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
router.post('/test-ai', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), testAiEndpoint);

// Motor categories
router.get('/categories', authenticate, getCategories);
router.post('/categories', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), addCategory);
router.delete('/categories/:name', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), deleteCategory);

export const settingsRouter = router;
