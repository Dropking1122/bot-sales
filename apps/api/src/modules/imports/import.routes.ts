import { Router } from 'express';
import {
  getMotorcycleTemplate,
  getContactTemplate,
  previewMotorcycleImport,
  executeMotorcycleImport,
  previewContactImport,
  executeContactImport,
  getImportJob,
  getImportJobErrors,
  exportImportErrorsExcel
} from './import.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { uploadExcel } from '../../middleware/upload';
import { AdminRole } from '@prisma/client';

const router = Router();

// Templates
router.get('/motorcycles/template', getMotorcycleTemplate);
router.get('/contacts/template', getContactTemplate);

// Motorcycle Import
router.post(
  '/motorcycles/preview',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  uploadExcel.single('file'),
  previewMotorcycleImport
);
router.post(
  '/motorcycles',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  executeMotorcycleImport
);

// Contact Import
router.post(
  '/contacts/preview',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  uploadExcel.single('file'),
  previewContactImport
);
router.post(
  '/contacts',
  authenticate,
  requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN),
  executeContactImport
);

// Job Status & Errors
router.get('/:jobId', authenticate, getImportJob);
router.get('/:jobId/errors', authenticate, getImportJobErrors);
router.get('/:jobId/errors/export', authenticate, exportImportErrorsExcel);

export const importsRouter = router;
