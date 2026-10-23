import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';

export async function getLeadsReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      _count: { id: true }
    });

    const totalLeads = leadsByStatus.reduce((acc, curr) => acc + curr._count.id, 0);
    const convertedLeads = leadsByStatus.find((l) => l.status === 'BERHASIL')?._count.id || 0;
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0;

    return res.json({
      success: true,
      data: {
        totalLeads,
        convertedLeads,
        conversionRate: `${conversionRate}%`,
        byStatus: leadsByStatus.map((l) => ({
          status: l.status,
          count: l._count.id
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getMessagesReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const messages = await prisma.message.groupBy({
      by: ['senderType'],
      _count: { id: true }
    });

    return res.json({
      success: true,
      data: {
        breakdown: messages.map((m) => ({
          sender: m.senderType,
          count: m._count.id
        }))
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getBroadcastsReport(_req: Request, res: Response, next: NextFunction) {
  try {
    const campaigns = await prisma.broadcastCampaign.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        totalTarget: true,
        sentCount: true,
        failedCount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });

    return res.json({ success: true, data: campaigns });
  } catch (err) {
    next(err);
  }
}
