import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@bot-sales/shared';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const { action, entity, search } = req.query;
    const where: any = {};

    if (action) where.action = String(action);
    if (entity) where.entity = String(entity);

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.OR = [
        { action: { contains: q, mode: 'insensitive' } },
        { entity: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q, mode: 'insensitive' } },
        { userAgent: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        include: {
          admin: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return res.json({
      success: true,
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}
