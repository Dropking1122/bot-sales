import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { waManager, sendWhatsAppTextMessage } from '../modules/whatsapp/whatsapp.service';
import { isValidPhoneNumber } from '@bot-sales/shared';

let isWorkerRunning = false;

/**
 * A recipient that has reached this many failed attempts is not retried automatically (retryCampaign
 * refuses it too), so a permanently failing number cannot loop the queue forever.
 */
export const MAX_SEND_ATTEMPTS = 3;

export function startBroadcastWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  logger.info('Starting Broadcast Background Worker...');

  // Orphaned SENDING rows come from a process that died between marking and the send result, so
  // delivery is UNKNOWN - not "not sent". Resetting them to PENDING (the old behaviour) re-sent
  // the promotion on every restart; FAILED with an explicit reason keeps the decision with the
  // operator, who can use "Kirim ulang" deliberately.
  prisma.broadcastRecipient.updateMany({
    where: { status: 'SENDING' },
    data: {
      status: 'FAILED',
      errorMessage: 'Pengiriman terputus (proses berhenti); status pengiriman tidak diketahui.',
      failedAt: new Date()
    }
  }).catch((err) => logger.error({ err }, 'Failed to close orphaned SENDING recipients'));

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

      // Re-check consent AND opt-out at send time: the audience was snapshotted when the campaign
      // was created, so a contact who withdrew consent afterwards must not still receive it.
      if (pendingRecipient.contact.isOptOut || pendingRecipient.contact.consentStatus !== 'GRANTED') {
        const reason = pendingRecipient.contact.isOptOut
          ? 'Kontak telah memilih opt-out'
          : `Persetujuan kontak tidak lagi GRANTED (${pendingRecipient.contact.consentStatus})`;
        await prisma.broadcastRecipient.update({
          where: { id: pendingRecipient.id },
          data: {
            status: 'SKIPPED',
            errorMessage: reason,
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

      // Shape first: a LID is 14-16 digits and isValidPhoneNumber() would accept a 14-15 digit one,
      // so a LID must be sent as the primary target rather than defaulted to '@c.us'.
      const normalizedIsLid = waManager.isLikelyLid(contact?.phoneNormalized || '');
      if (normalizedIsLid) {
        targetPhone = contact.phoneNormalized;
        fallbackJid = recordedLid && recordedLid !== contact.phoneNormalized ? recordedLid : null;
      } else if (contact?.phoneNormalized && isValidPhoneNumber(contact.phoneNormalized)) {
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
