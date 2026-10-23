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

export async function getNotifications(_req: Request, res: Response, next: NextFunction) {
  try {
    const [recentLeads, recentMessages, activeCampaigns] = await Promise.all([
      prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          motorcycle: { select: { name: true } }
        }
      }),
      prisma.message.findMany({
        take: 5,
        where: { senderType: 'CUSTOMER' },
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: { contact: true }
          }
        }
      }),
      prisma.broadcastCampaign.findMany({
        take: 3,
        orderBy: { createdAt: 'desc' }
      })
    ]);

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'lead' | 'message' | 'campaign' | 'system';
      time: string;
      link: string;
      read: boolean;
    }> = [];

    // Map leads
    recentLeads.forEach((lead) => {
      notifications.push({
        id: `lead-${lead.id}`,
        title: `Lead ${lead.status}: ${lead.customerName || 'Prospek Baru'}`,
        message: `Minat: ${lead.motorcycle?.name || 'Unit Motor'} • Kontak: ${lead.phone}`,
        type: 'lead',
        time: lead.createdAt.toISOString(),
        link: '/leads',
        read: lead.status !== 'BARU'
      });
    });

    // Map messages
    recentMessages.forEach((msg) => {
      notifications.push({
        id: `msg-${msg.id}`,
        title: `Pesan: ${msg.conversation?.contact?.name || msg.conversation?.contact?.phone || 'Konsumen'}`,
        message: msg.content.length > 55 ? msg.content.substring(0, 55) + '...' : msg.content,
        type: 'message',
        time: msg.createdAt.toISOString(),
        link: '/inbox',
        read: msg.status === 'READ'
      });
    });

    // Map campaigns
    activeCampaigns.forEach((camp) => {
      notifications.push({
        id: `camp-${camp.id}`,
        title: `Broadcast: ${camp.name}`,
        message: `Status: ${camp.status} (${camp.sentCount}/${camp.totalTarget} terkirim)`,
        type: 'campaign',
        time: camp.createdAt.toISOString(),
        link: '/broadcasts',
        read: true
      });
    });

    // Fallback system notification if empty
    if (notifications.length === 0) {
      notifications.push({
        id: 'sys-online',
        title: 'Sistem DMS Aktif',
        message: 'Koneksi database & WhatsApp gateway siap beroperasi.',
        type: 'system',
        time: new Date().toISOString(),
        link: '/settings',
        read: false
      });
    }

    notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    const unreadCount = notifications.filter((n) => !n.read).length;

    return res.json({
      success: true,
      data: {
        unreadCount,
        notifications
      }
    });
  } catch (err) {
    next(err);
  }
}

