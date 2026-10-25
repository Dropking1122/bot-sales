import { Router } from 'express';
import {
  listCampaigns,
  getCampaignById,
  createCampaign,
  previewCampaignRecipients,
  startCampaign,
  pauseCampaign,
  cancelCampaign,
  retryCampaign,
  getCampaignRecipients,
  exportCampaignReport,
  listTemplates,
  createTemplate,
  deleteTemplate
} from './broadcast.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, listCampaigns);
router.post('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createCampaign);
router.post('/preview', authenticate, previewCampaignRecipients);

// Templates
router.get('/templates', authenticate, listTemplates);
router.post('/templates', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), createTemplate);
router.delete('/templates/:id', authenticate, requireRoles(AdminRole.SUPER_ADMIN), deleteTemplate);

// Campaign actions
router.get('/:id', authenticate, getCampaignById);
router.post('/:id/start', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), startCampaign);
router.post('/:id/pause', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), pauseCampaign);
router.post('/:id/cancel', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), cancelCampaign);
router.post('/:id/retry', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), retryCampaign);
router.get('/:id/recipients', authenticate, getCampaignRecipients);
router.get('/:id/report', authenticate, exportCampaignReport);

export const broadcastsRouter = router;
