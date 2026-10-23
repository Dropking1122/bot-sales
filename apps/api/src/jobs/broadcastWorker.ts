import { prisma } from '../config/db';
import { logger } from '../config/logger';
import { waManager, sendWhatsAppTextMessage } from '../modules/whatsapp/whatsapp.service';

let isWorkerRunning = false;

export function startBroadcastWorker() {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  logger.info('Starting Broadcast Background Worker...');

  const loop = async () => {
    try {
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
        // All recipients processed! Mark campaign COMPLETED
        await prisma.broadcastCampaign.update({
          where: { id: activeCampaign.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        });
        logger.info(`Campaign ${activeCampaign.name} (${activeCampaign.id}) COMPLETED.`);
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

      // Send via WhatsApp Web
      const messageText = pendingRecipient.personalizedMessage || activeCampaign.messageTemplate;
      let sentSuccess = false;
      let sendError: string | null = null;

      try {
        await sendWhatsAppTextMessage(pendingRecipient.phone, messageText);
        sentSuccess = true;
      } catch (err: any) {
        sendError = err.message || 'Gagal mengirim pesan WhatsApp';
        sentSuccess = false;
      }

      if (sentSuccess) {
        await prisma.broadcastRecipient.update({
          where: { id: pendingRecipient.id },
          data: {
            status: 'SENT',
            sentAt: new Date()
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
