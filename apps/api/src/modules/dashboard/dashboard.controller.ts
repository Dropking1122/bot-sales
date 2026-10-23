import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { waManager } from '../whatsapp/whatsapp.service';
import { redis } from '../../config/redis';

export async function getDashboardSummary(_req: Request, res: Response, next: NextFunction) {
  try {
    const [
      activeMotorcycles,
      totalBrands,
      totalContacts,
      totalCustomers,
      totalLeads,
      newLeads,
      totalConversations,
      runningBroadcasts,
      completedBroadcasts,
      recentAuditLogs
    ] = await Promise.all([
      prisma.motorcycle.count({ where: { isActive: true } }),
      prisma.brand.count({ where: { isActive: true } }),
      prisma.contact.count(),
      prisma.customer.count(),
      prisma.lead.count(),
      prisma.lead.count({ where: { status: 'BARU' } }),
      prisma.conversation.count(),
      prisma.broadcastCampaign.count({ where: { status: 'RUNNING' } }),
      prisma.broadcastCampaign.count({ where: { status: 'COMPLETED' } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { name: true, email: true } } }
      })
    ]);

    // Message counts
    const [inboundMessages, outboundMessages] = await Promise.all([
      prisma.message.count({ where: { senderType: 'CUSTOMER' } }),
      prisma.message.count({ where: { senderType: { in: ['BOT', 'SALES'] } } })
    ]);

    // WhatsApp status
    const waStatus = waManager.getStatus();

    // Check redis status
    let redisConnected = false;
    try {
      redisConnected = redis.status === 'ready' || redis.status === 'connect';
    } catch (e) {
      redisConnected = false;
    }

    return res.json({
      success: true,
      data: {
        counts: {
          activeMotorcycles,
          totalBrands,
          totalContacts,
          totalCustomers,
          totalLeads,
          newLeads,
          totalConversations,
          inboundMessages,
          outboundMessages,
          runningBroadcasts,
          completedBroadcasts
        },
        services: {
          database: 'CONNECTED',
          redis: redisConnected ? 'CONNECTED' : 'STANDBY',
          whatsapp: waStatus.status
        },
        recentActivities: recentAuditLogs
      }
    });
  } catch (err) {
    next(err);
  }
}
