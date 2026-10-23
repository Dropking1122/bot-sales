import { Router } from 'express';
import { exportMotorcycles, exportContacts, exportLeads } from './export.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/motorcycles', authenticate, exportMotorcycles);
router.get('/contacts', authenticate, exportContacts);
router.get('/leads', authenticate, exportLeads);

export const exportsRouter = router;
