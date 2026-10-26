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
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [notifMessages, recentContacts, activeCampaigns] = await Promise.all([
      prisma.message.findMany({
        take: 20,
        where: {
          senderType: 'CUSTOMER',
          OR: [
            { status: { in: ['UNREAD_NEW_CLIENT', 'UNREAD_INACTIVE'] } },
            { createdAt: { gte: sevenDaysAgo } }
          ]
        },
        orderBy: { createdAt: 'desc' },
        include: {
          conversation: {
            include: { contact: true }
          }
        }
      }),
      prisma.contact.findMany({
        take: 10,
        where: {
          createdAt: { gte: twoDaysAgo }
        },
        orderBy: { createdAt: 'desc' }
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

    const seenContactIds = new Set<string>();

    // 1. Process client baru & chat setelah inaktif
    notifMessages.forEach((msg) => {
      const contact = msg.conversation?.contact;
      if (contact) seenContactIds.add(contact.id);
      const contactName = contact?.name || contact?.phoneNormalized || 'Pelanggan';
      const isNewClient = msg.status === 'UNREAD_NEW_CLIENT';
      const isInactive = msg.status === 'UNREAD_INACTIVE';
      const isUnread = isNewClient || isInactive;

      // Filter: only include messages that were flagged as new client, inactive re-activation, or unread
      if (isNewClient || isInactive || msg.status === 'READ') {
        notifications.push({
          id: `msg-${msg.id}`,
          title: isNewClient
            ? `👤 Client Baru: ${contactName}`
            : `💬 Chat Re-aktif: ${contactName}`,
          message: msg.content.length > 55 ? msg.content.substring(0, 55) + '...' : msg.content,
          type: isNewClient ? 'lead' : 'message',
          time: msg.createdAt.toISOString(),
          link: '/inbox',
          read: !isUnread
        });
      }
    });

    // 2. Process new contacts from other sources or without chat yet
    recentContacts.forEach((c) => {
      if (!seenContactIds.has(c.id)) {
        notifications.push({
          id: `contact-${c.id}`,
          title: `👤 Client Baru: ${c.name || c.phoneNormalized}`,
          message: `Kontak baru masuk via ${c.source || 'WhatsApp'} (${c.phoneNormalized})`,
          type: 'lead',
          time: c.createdAt.toISOString(),
          link: '/inbox',
          read: false
        });
      }
    });

    // 3. Map campaigns
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

