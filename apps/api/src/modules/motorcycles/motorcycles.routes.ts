import { Router } from 'express';
import {
  listMotorcycles,
  getMotorcycleById,
  createMotorcycle,
  updateMotorcycle,
  deleteMotorcycle,
  uploadMotorcycleImages,
  deleteMotorcycleImage,
  setPrimaryImage
} from './motorcycles.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { uploadImage } from '../../middleware/upload';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, listMotorcycles);
router.get('/:id', authenticate, getMotorcycleById);
router.post('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createMotorcycle);
router.patch('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateMotorcycle);
router.delete('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), deleteMotorcycle);

// Images
router.post(
  '/:id/images',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  uploadImage.array('images', 10),
  uploadMotorcycleImages
);
router.delete(
  '/:id/images/:imageId',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  deleteMotorcycleImage
);
router.patch(
  '/:id/images/:imageId/primary',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  setPrimaryImage
);

export const motorcyclesRouter = router;
