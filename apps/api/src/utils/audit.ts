import { Request } from 'express';
import { prisma } from '../config/db';
import { logger } from '../config/logger';

export async function logAudit(
  req: Request | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: Record<string, any>
) {
  try {
    const adminId = req?.user?.id || null;
    const ipAddress = req?.ip || (req?.headers['x-forwarded-for'] as string) || null;
    const userAgent = req?.headers['user-agent'] || null;

    await prisma.auditLog.create({
      data: {
        adminId,
        action,
        entity,
        entityId: entityId || null,
        details: details || {},
        ipAddress: typeof ipAddress === 'string' ? ipAddress.split(',')[0].trim() : null,
        userAgent
      }
    });
  } catch (error) {
    logger.error({ error, action, entity }, 'Failed to write audit log');
  }
}
