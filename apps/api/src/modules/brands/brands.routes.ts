import { Router } from 'express';
import { listBrands, createBrand, updateBrand, deleteBrand } from './brands.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, listBrands);
router.post('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createBrand);
router.patch('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateBrand);
router.delete('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN), deleteBrand);

export const brandsRouter = router;
