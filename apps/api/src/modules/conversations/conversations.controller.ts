import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';
import { sendWhatsAppTextMessage } from '../whatsapp/whatsapp.service';
import { logger } from '../../config/logger';

// SALES scope: a rep may only read or act on its own conversations plus the shared unassigned queue
// (that queue is the point of the inbox). Admins are unrestricted.
// ponytail: owner scope, not per-rep hiding of the unassigned queue — add a per-rep queue flag if
// reps ever must not see each other's fresh customers.
function salesScope(req: Request) {
  return req.user?.role === AdminRole.SALES
    ? { OR: [{ assignedToAdminId: req.user?.id }, { assignedToAdminId: null }] }
    : {};
}

// Every conversation-id handler passes through here; without it any token holder can act on any chat.
async function assertConversationAccess(req: Request, id: string) {
  if (req.user?.role !== AdminRole.SALES) return;

  const row = await prisma.conversation.findUnique({
    where: { id },
    select: { assignedToAdminId: true }
  });

  if (!row || (row.assignedToAdminId && row.assignedToAdminId !== req.user?.id)) {
    throw new AppError('Percakapan tidak ditemukan', 404);
  }
}

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, search, assignedTo } = req.query;
    const where: any = { ...salesScope(req) };

    if (status) where.status = String(status);
    if (assignedTo) where.assignedToAdminId = String(assignedTo);
    if (search) {
      where.contact = {
        OR: [
          { name: { contains: String(search), mode: 'insensitive' } },
          { phoneNormalized: { contains: String(search) } }
        ]
      };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phoneNormalized: true } },
        assignedAdmin: { select: { id: true, name: true } },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100
    });

    return res.json({ success: true, data: conversations });
  } catch (err) {
    next(err);
  }
}

export async function getConversationMessages(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await assertConversationAccess(req, id);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        assignedAdmin: { select: { id: true, name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200
        }
      }
    });

    if (!conversation) {
      throw new AppError('Percakapan tidak ditemukan', 404);
    }

    // Mark unread customer messages as READ in background
    prisma.message.updateMany({
      where: {
        conversationId: id,
        senderType: 'CUSTOMER',
        status: { not: 'READ' }
      },
      data: { status: 'READ' }
    }).catch(() => {});

    return res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
}

export async function sendManualReply(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    await assertConversationAccess(req, id);

    if (!message || !message.trim()) {
      throw new AppError('Pesan tidak boleh kosong', 400);
    }

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { contact: true }
    });

    if (!conv) {
      throw new AppError('Percakapan tidak ditemukan', 404);
    }

    if (conv.contact.phone?.includes('@newsletter') || conv.contact.phoneNormalized?.includes('newsletter')) {
      throw new AppError('Tidak dapat mengirim pesan ke Saluran WhatsApp (Channel bersifat siaran satu arah).', 400);
    }

    const lidMatch = conv.contact.internalNotes?.match(/\[LID:\s*([^\]]+)\]/);
    const lidJid = lidMatch ? lidMatch[1].trim() : null;

    const recipient =
      lidJid ||
      (conv.contact.phone && conv.contact.phone.includes('@')
        ? conv.contact.phone
        : `${conv.contact.phoneNormalized}@c.us`);

    // Try to send via WhatsApp Web if connected
    let waMessageId: string | undefined;
    try {
      const sent = await sendWhatsAppTextMessage(recipient, message.trim());
      if (sent?.id?.id) {
        waMessageId = sent.id.id;
      }
    } catch (e: any) {
      throw new AppError(e?.message || 'Gagal mengirim pesan WhatsApp. Pastikan bot terhubung.', 400);
    }

    // Store in DB
    const createdMessage = await prisma.message.create({
      data: {
        conversationId: id,
        senderType: 'SALES',
        content: message.trim(),
        waMessageId: waMessageId || null,
        status: waMessageId ? 'SENT' : 'PENDING'
      }
    });

    await prisma.conversation.update({
      where: { id },
      data: {
        lastMessageAt: new Date(),
        assignedToAdminId: req.user!.id,
        isBotActive: false,
        status: 'HANDOFF'
      }
    });

    return res.status(201).json({ success: true, data: createdMessage });
  } catch (err) {
    next(err);
  }
}

export async function takeoverBot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await assertConversationAccess(req, id);

    const conv = await prisma.conversation.update({
      where: { id },
      data: {
        isBotActive: false,
        status: 'HANDOFF',
        assignedToAdminId: req.user!.id
      }
    });

    await logAudit(req, 'TAKEOVER_CONVERSATION', 'Conversation', id);

    return res.json({ success: true, message: 'Sales berhasil mengambil alih percakapan (Bot dinonaktifkan)', data: conv });
  } catch (err) {
    next(err);
  }
}

export async function resumeBot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await assertConversationAccess(req, id);

    const conv = await prisma.conversation.update({
      where: { id },
      data: {
        isBotActive: true,
        status: 'ACTIVE'
      }
    });

    await logAudit(req, 'RESUME_BOT', 'Conversation', id);

    return res.json({ success: true, message: 'Bot diaktifkan kembali untuk percakapan ini', data: conv });
  } catch (err) {
    next(err);
  }
}

export async function transferConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { targetAdminId, reason } = req.body;
    await assertConversationAccess(req, id);

    if (!targetAdminId) {
      throw new AppError('Admin / Sales tujuan wajib dipilih', 400);
    }

    const targetAdmin = await prisma.admin.findUnique({
      where: { id: targetAdminId }
    });

    if (!targetAdmin || !targetAdmin.isActive) {
      throw new AppError('Sales tujuan tidak ditemukan atau tidak aktif', 404);
    }

    const conv = await prisma.conversation.findUnique({
      where: { id },
      include: { contact: true }
    });

    if (!conv) {
      throw new AppError('Percakapan tidak ditemukan', 404);
    }

    // Update conversation assigned admin
    const updatedConv = await prisma.conversation.update({
      where: { id },
      data: {
        assignedToAdminId: targetAdmin.id,
        isBotActive: false,
        status: 'HANDOFF'
      },
      include: {
        contact: true,
        assignedAdmin: { select: { id: true, name: true, phone: true } }
      }
    });

    // Update active lead assigned sales as well
    await prisma.lead.updateMany({
      where: { contactId: conv.contactId },
      data: { assignedSalesId: targetAdmin.id }
    });

    // If target admin has WhatsApp phone registered, send internal notification to their WhatsApp
    if (targetAdmin.phone && targetAdmin.phone.trim().length >= 8) {
      const clientName = conv.contact.name || conv.contact.phoneNormalized;
      const cleanPhone = targetAdmin.phone.replace(/[^0-9]/g, '');
      const transferMsg =
        `📢 *PENGALIHAN OBROLAN PELANGGAN*\n\n` +
        `Pelanggan: *${clientName}* (${conv.contact.phoneNormalized || '-'})\n` +
        `Dialihkan oleh: *${req.user?.name || 'Sales'}*\n` +
        (reason ? `Catatan: _"${reason}"_\n` : '') +
        `\nMohon segera ditindaklanjuti melalui DMS Admin: https://m.revd.dev/inbox`;

      sendWhatsAppTextMessage(`${cleanPhone}@c.us`, transferMsg).catch((err: any) => {
        logger.warn({ err: err?.message, targetPhone: targetAdmin.phone }, 'Failed to notify target admin via WA');
      });
    }

    await logAudit(req, 'TRANSFER_CONVERSATION', 'Conversation', id, {
      fromAdminId: req.user?.id,
      toAdminId: targetAdmin.id,
      targetName: targetAdmin.name,
      reason
    });

    return res.json({
      success: true,
      message: `Percakapan berhasil dialihkan ke ${targetAdmin.name}`,
      data: updatedConv
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await assertConversationAccess(req, id);

    await prisma.message.deleteMany({
      where: { conversationId: id }
    });

    await prisma.conversation.delete({
      where: { id }
    });

    await logAudit(req, 'DELETE_CONVERSATION', 'Conversation', id);

    return res.json({ success: true, message: 'Percakapan berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
