import { Router } from 'express';
import { listAuditLogs } from './audit-logs.controller';
import { authenticate, requireRoles } from '../../middleware/auth';
import { AdminRole } from '@prisma/client';

const router = Router();

router.get('/', authenticate, requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN), listAuditLogs);

export const auditLogsRouter = router;
