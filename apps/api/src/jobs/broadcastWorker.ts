import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { waManager, sendWhatsAppTextMessage } from '../modules/whatsapp/whatsapp.service';
import { isValidPhoneNumber } from '@bot-sales/shared';

let isWorkerRunning = false;

export function startBroadcastWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  logger.info('Starting Broadcast Background Worker...');

  // Reset orphaned SENDING recipients from prior interrupted runs
  prisma.broadcastRecipient.updateMany({
    where: { status: 'SENDING' },
    data: { status: 'PENDING' }
  }).catch((err) => logger.error({ err }, 'Failed to reset orphaned SENDING recipients'));

  const loop = async () => {
    try {
      // Auto-activate SCHEDULED campaigns whose scheduled time has arrived
      const now = new Date();
      await prisma.broadcastCampaign.updateMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: now }
        },
        data: {
          status: 'RUNNING',
          startedAt: now
        }
      });

      // Find one active campaign
      const activeCampaign = await prisma.broadcastCampaign.findFirst({
        where: { status: 'RUNNING' },
        include: {
          recipients: {
            where: { status: 'PENDING' },
            take: 1,
            include: { contact: true }
          }
        }
      });

      if (!activeCampaign) {
        // No running campaign, check again after 4 seconds
        setTimeout(loop, 4000);
        return;
      }

      const pendingRecipient = activeCampaign.recipients[0];

      if (!pendingRecipient) {
        // All recipients processed! Compute final stats
        const [finalSent, finalFailed] = await Promise.all([
          prisma.broadcastRecipient.count({ where: { campaignId: activeCampaign.id, status: 'SENT' } }),
          prisma.broadcastRecipient.count({ where: { campaignId: activeCampaign.id, status: 'FAILED' } })
        ]);

        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: {
            status: finalSent === 0 && finalFailed > 0 ? 'FAILED' : 'COMPLETED',
            sentCount: finalSent,
            failedCount: finalFailed,
            completedAt: new Date()
          }
        });
        logger.info(`Campaign ${activeCampaign.name} (${activeCampaign.id}) finished (Sent: ${finalSent}, Failed: ${finalFailed}).`);
        setTimeout(loop, 2000);
        return;
      }

      // Check WhatsApp connection status
      const waStatus = waManager.getStatus();
      if (waStatus.status !== 'CONNECTED') {
        logger.warn('Broadcast paused: WhatsApp client is not CONNECTED');
        // Pause campaign so admin can re-connect
        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: { status: 'PAUSED' }
        });
        setTimeout(loop, 5000);
        return;
      }

      // Check opt-out before sending
      if (pendingRecipient.contact.isOptOut) {
        await prisma.broadcastRecipient.update({
          where: { id: pendingRecipient.id },
          data: {
            status: 'SKIPPED',
            errorMessage: 'Kontak telah memilih opt-out',
            failedAt: new Date()
          }
        });

        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: { skippedCount: { increment: 1 } }
        });

        setTimeout(loop, 500);
        return;
      }

      // Mark recipient as SENDING
      await prisma.broadcastRecipient.update({
        where: { id: pendingRecipient.id },
        data: { status: 'SENDING' }
      });

      // Resolve best target phone & fallback LID
      const contact = pendingRecipient.contact;
      let targetPhone = pendingRecipient.phone;
      let fallbackJid: string | null = null;

      const lidMatch = contact?.internalNotes?.match(/\[LID:\s*([^\]]+)\]/);
      const recordedLid = lidMatch ? lidMatch[1].trim() : (contact?.phone?.includes('@lid') ? contact.phone : null);

      if (contact?.phoneNormalized && isValidPhoneNumber(contact.phoneNormalized)) {
        targetPhone = contact.phoneNormalized;
        fallbackJid = recordedLid;
      } else if (recordedLid) {
        targetPhone = recordedLid;
      }

      // Send via WhatsApp Web
      const messageText = pendingRecipient.personalizedMessage || activeCampaign.messageTemplate;
      let sentSuccess = false;
      let sendError: string | null = null;

      try {
        await sendWhatsAppTextMessage(targetPhone, messageText, {
          fallbackJid,
          mediaUrl: activeCampaign.mediaUrl
        });
        sentSuccess = true;
      } catch (err: any) {
        sendError = err.message || 'Gagal mengirim pesan WhatsApp';
        sentSuccess = false;
      }

      if (sentSuccess) {
        await prisma.broadcastRecipient.update({
          where: { id: pendingRecipient.id },
          data: {
            phone: targetPhone,
            status: 'SENT',
            sentAt: new Date(),
            errorMessage: null
          }
        });

        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: { sentCount: { increment: 1 } }
        });
      } else {
        await prisma.broadcastRecipient.update({
          where: { id: pendingRecipient.id },
          data: {
            phone: targetPhone,
            status: 'FAILED',
            failedAt: new Date(),
            errorMessage: sendError,
            retryCount: { increment: 1 }
          }
        });

        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: { failedCount: { increment: 1 } }
        });
      }

      // Delay between messages (2.5 seconds to protect WA account)
      setTimeout(loop, 2500);
    } catch (error) {
      logger.error({ error }, 'Broadcast Worker error');
      setTimeout(loop, 5000);
    }
  };

  loop();
}
