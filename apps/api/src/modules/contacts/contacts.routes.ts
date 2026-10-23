import { Router } from 'express';
import {
  listContacts,
  getContactById,
  createContact,
  updateContact,
  deleteContact,
  bulkAddTags,
  listAllTags
} from './contacts.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, listContacts);
router.get('/tags', authenticate, listAllTags);
router.get('/:id', authenticate, getContactById);
router.post('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN, AdminRole.SALES), createContact);
router.patch('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), updateContact);
router.delete('/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), deleteContact);
router.post('/bulk-tags', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), bulkAddTags);

export const contactsRouter = router;
