import { Router } from 'express';
import { listLeads, createLead, updateLead } from './leads.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, listLeads);
router.post('/', authenticate, createLead);
router.patch('/:id', authenticate, updateLead);

export const leadsRouter = router;
