import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';
import { sendWhatsAppTextMessage } from '../whatsapp/whatsapp.service';

export async function listConversations(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, search, assignedTo } = req.query;
    const where: any = {};

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

export async function deleteConversation(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

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
