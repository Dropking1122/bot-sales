import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { isNotificationRead } from '@bot-sales/shared';
import { prisma } from '../../config/db';
import { waManager } from '../whatsapp/whatsapp.service';
import { redis } from '../../config/redis';

// Audit and diagnostic rows are gated to the audit-log roles elsewhere (`/audit-logs`), so the
// dashboard must not re-expose them to SALES. Counters stay visible for everyone.
function isAuditReader(req: Request) {
  return req.user?.role === AdminRole.SUPER_ADMIN || req.user?.role === AdminRole.ADMIN;
}

// Fallback clock for a WhatsApp alert when no session row exists yet. Must be stable across polls,
// so it is captured once per process rather than per request.
const PROCESS_STARTED_AT = new Date();

export async function getDashboardSummary(req: Request, res: Response, next: NextFunction) {
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
      isAuditReader(req)
        ? prisma.auditLog.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { admin: { select: { name: true, email: true } } }
          })
        : Promise.resolve([])
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

export async function getNotifications(req: Request, res: Response, next: NextFunction) {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [notifMessages, recentContacts, activeCampaigns, securityAndErrorLogs, readState, waSession] = await Promise.all([
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
      }),
      isAuditReader(req)
        ? prisma.auditLog.findMany({
            take: 10,
            where: {
              entity: { in: ['SECURITY_ALERT', 'SYSTEM_ERROR'] },
              createdAt: { gte: sevenDaysAgo }
            },
            orderBy: { createdAt: 'desc' }
          })
        : Promise.resolve([]),
      prisma.admin.findUnique({
        where: { id: req.user!.id },
        select: { notificationsReadAt: true }
      }),
      prisma.whatsAppSession.findUnique({ where: { sessionName: 'default' } })
    ]);

    // A notification is "read" when it is older than the admin's read watermark. The watermark only
    // ever moves forward, so clicking an old item cannot resurrect newer unread ones.
    const readAt = readState?.notificationsReadAt ?? null;
    const isRead = (createdAt: Date | string) => isNotificationRead(createdAt, readAt);

    const notifications: Array<{
      id: string;
      title: string;
      message: string;
      type: 'lead' | 'message' | 'campaign' | 'system';
      time: string;
      link: string;
      read: boolean;
    }> = [];

    // 0. Alert jika koneksi WhatsApp terputus atau QR expired
    const currentWa = waManager.getStatus();
    if (currentWa.status === 'DISCONNECTED' || currentWa.status === 'QR_READY') {
      // Time comes from the DB row, not from `new Date()`: a per-request timestamp made this item
      // look freshly created on every poll, so it could never age past the read watermark.
      const alertTime = waSession?.updatedAt ?? PROCESS_STARTED_AT;
      notifications.push({
        id: 'wa-disconnected-alert',
        title: '⚠️ WhatsApp Terputus!',
        message: currentWa.status === 'QR_READY'
          ? 'Sesi WhatsApp memerlukan scan QR ulang untuk menghubungkan bot.'
          : 'Koneksi WhatsApp terputus. Klik untuk membuka pengaturan dan menghubungkan kembali.',
        type: 'system',
        time: alertTime.toISOString(),
        link: '/settings',
        read: isRead(alertTime)
      });
    }

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
          read: !isUnread || isRead(msg.createdAt)
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
          read: isRead(c.createdAt)
        });
      }
    });

    // 3. Map security attacks and system error logs
    securityAndErrorLogs.forEach((log) => {
      const isSecurity = log.entity === 'SECURITY_ALERT';
      const details = (log.details as any) || {};

      if (isSecurity) {
        notifications.push({
          id: `sec-${log.id}`,
          title: `🚨 Serangan: ${details.attackType || log.action}`,
          message: `IP: ${log.ipAddress || '-'} • Target: ${details.path || '-'}`,
          type: 'system',
          time: log.createdAt.toISOString(),
          link: '/audit-logs?entity=SECURITY_ALERT',
          read: isRead(log.createdAt)
        });
      } else {
        notifications.push({
          id: `err-${log.id}`,
          title: `⚠️ Error: ${details.message || log.action}`,
          message: `${details.method || ''} ${details.path || ''} - ${details.message || 'Server error'}`,
          type: 'system',
          time: log.createdAt.toISOString(),
          link: '/audit-logs?entity=SYSTEM_ERROR',
          read: isRead(log.createdAt)
        });
      }
    });

    // 4. Map campaigns
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

    // Fallback system notification if empty. Informational only, never an alert, so it must not
    // inflate the badge: a per-request timestamp would also make it look new on every poll.
    if (notifications.length === 0) {
      notifications.push({
        id: 'sys-online',
        title: 'Sistem DMS Aktif',
        message: 'Koneksi database & WhatsApp gateway siap beroperasi.',
        type: 'system',
        time: new Date().toISOString(),
        link: '/settings',
        read: true
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

/**
 * Marks notifications as read by advancing the admin's read watermark.
 * The client sends the newest notification time it has seen; the stored watermark only moves
 * forward, so a later poll can never mark a newer notification read by accident.
 */
export async function markNotificationsRead(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = (req.body || {}).until;
    const until = raw ? new Date(raw) : new Date();

    if (raw && Number.isNaN(until.getTime())) {
      return res.status(400).json({ success: false, message: 'Nilai waktu tidak valid.' });
    }

    // Never move the watermark backwards, and never into the future.
    const now = new Date();
    const target = until > now ? now : until;

    const current = await prisma.admin.findUnique({
      where: { id: req.user!.id },
      select: { notificationsReadAt: true }
    });

    if (!current?.notificationsReadAt || current.notificationsReadAt < target) {
      await prisma.admin.update({
        where: { id: req.user!.id },
        data: { notificationsReadAt: target }
      });
    }

    return res.json({ success: true, data: { readAt: target.toISOString() } });
  } catch (err) {
    next(err);
  }
}

