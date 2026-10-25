import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { BroadcastCampaignSchema, DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, isValidPhoneNumber, sanitizeForExcel } from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';
import { resolveBroadcastRecipients, interpolateTemplate } from './broadcast.service';
import ExcelJS from 'exceljs';

export async function listCampaigns(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const { status, search } = req.query;
    const where: any = {};

    if (status) where.status = String(status);
    if (search) where.name = { contains: String(search), mode: 'insensitive' };

    const [total, campaigns] = await Promise.all([
      prisma.broadcastCampaign.count({ where }),
      prisma.broadcastCampaign.findMany({
        where,
        skip,
        take: limit,
        include: {
          createdBy: { select: { name: true, email: true } },
          motorcycle: { select: { id: true, name: true } },
          _count: { select: { recipients: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return res.json({
      success: true,
      data: campaigns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const campaign = await prisma.broadcastCampaign.findUnique({
      where: { id },
      include: {
        createdBy: { select: { name: true, email: true } },
        motorcycle: {
          include: { brand: true, images: { where: { isPrimary: true }, take: 1 } }
        },
        _count: { select: { recipients: true } }
      }
    });

    if (!campaign) {
      throw new AppError('Kampanye tidak ditemukan', 404);
    }

    return res.json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
}

export async function createCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const data = BroadcastCampaignSchema.parse(req.body);

    // Resolve eligible recipients
    const recipients = await resolveBroadcastRecipients(data.recipientFilter);
    if (recipients.length === 0) {
      throw new AppError('Tidak ada kontak yang memenuhi filter persetujuan (consent = GRANTED & tidak opt-out)', 400);
    }

    let motorcycle = null;
    if (data.motorcycleId) {
      motorcycle = await prisma.motorcycle.findUnique({
        where: { id: data.motorcycleId },
        include: { brand: true }
      });
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const camp = await tx.broadcastCampaign.create({
        data: {
          name: data.name,
          description: data.description || null,
          campaignType: data.campaignType,
          status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
          messageTemplate: data.messageTemplate,
          mediaUrl: data.mediaUrl || null,
          motorcycleId: data.motorcycleId || null,
          scheduledAt: data.scheduledAt || null,
          totalTarget: recipients.length,
          createdById: req.user!.id
        }
      });

      // Prepare recipients with personalized message snapshot and idempotency key (batch insert)
      const recipientData = await Promise.all(
        recipients.map(async (r) => {
          const personalized = await interpolateTemplate(data.messageTemplate, r, motorcycle);
          const resolvedPhone =
            isValidPhoneNumber(r.phoneNormalized)
              ? r.phoneNormalized
              : (r.phone && !r.phone.includes('@lid') ? r.phone : r.phoneNormalized);

          return {
            campaignId: camp.id,
            contactId: r.id,
            phone: resolvedPhone,
            personalizedMessage: personalized,
            status: 'PENDING' as const,
            idempotencyKey: `${camp.id}_${r.id}`
          };
        })
      );

      if (recipientData.length > 0) {
        await tx.broadcastRecipient.createMany({
          data: recipientData,
          skipDuplicates: true
        });
      }

      return camp;
    });

    await logAudit(req, 'CREATE_CAMPAIGN', 'BroadcastCampaign', campaign.id, {
      name: campaign.name,
      recipients: recipients.length
    });

    return res.status(201).json({
      success: true,
      message: `Kampanye dibuat dengan ${recipients.length} penerima`,
      data: campaign
    });
  } catch (err) {
    next(err);
  }
}

export async function previewCampaignRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const { recipientFilter, messageTemplate, motorcycleId } = req.body;

    const filter = recipientFilter || { onlyConsented: true };
    const recipients = await resolveBroadcastRecipients(filter);

    let motorcycle = null;
    if (motorcycleId) {
      motorcycle = await prisma.motorcycle.findUnique({
        where: { id: motorcycleId },
        include: { brand: true }
      });
    }

    const samplePreviews = [];
    for (let i = 0; i < Math.min(3, recipients.length); i++) {
      const r = recipients[i];
      const msg = await interpolateTemplate(messageTemplate || '', r, motorcycle);
      samplePreviews.push({
        contactName: r.name,
        phone: r.phoneNormalized,
        previewMessage: msg
      });
    }

    return res.json({
      success: true,
      data: {
        totalEligible: recipients.length,
        samples: samplePreviews
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function startCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const campaign = await prisma.broadcastCampaign.findUnique({
      where: { id },
      include: { recipients: { where: { status: 'PENDING' } } }
    });

    if (!campaign) {
      throw new AppError('Kampanye tidak ditemukan', 404);
    }

    if (campaign.status === 'RUNNING') {
      throw new AppError('Kampanye sudah dalam proses pengiriman', 400);
    }

    await prisma.broadcastCampaign.update({
      where: { id },
      data: {
        status: 'RUNNING',
        startedAt: campaign.startedAt || new Date()
      }
    });

    await logAudit(req, 'START_CAMPAIGN', 'BroadcastCampaign', id);

    return res.json({ success: true, message: 'Kampanye broadcast mulai dijalankan' });
  } catch (err) {
    next(err);
  }
}

export async function pauseCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    await prisma.broadcastCampaign.update({
      where: { id },
      data: { status: 'PAUSED' }
    });

    await logAudit(req, 'PAUSE_CAMPAIGN', 'BroadcastCampaign', id);

    return res.json({ success: true, message: 'Kampanye berhasil dijeda' });
  } catch (err) {
    next(err);
  }
}

export async function cancelCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    await prisma.$transaction([
      prisma.broadcastCampaign.update({
        where: { id },
        data: { status: 'CANCELLED' }
      }),
      prisma.broadcastRecipient.updateMany({
        where: { campaignId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' }
      })
    ]);

    await logAudit(req, 'CANCEL_CAMPAIGN', 'BroadcastCampaign', id);

    return res.json({ success: true, message: 'Kampanye berhasil dibatalkan' });
  } catch (err) {
    next(err);
  }
}

export async function retryCampaign(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const campaign = await prisma.broadcastCampaign.findUnique({
      where: { id },
      include: {
        recipients: {
          where: { status: 'FAILED' },
          include: { contact: true }
        }
      }
    });

    if (!campaign) {
      throw new AppError('Kampanye tidak ditemukan', 404);
    }

    if (campaign.status === 'RUNNING') {
      throw new AppError('Kampanye sedang berjalan', 400);
    }

    if (campaign.recipients.length === 0) {
      throw new AppError('Tidak ada penerima yang berstatus gagal untuk dikirim ulang', 400);
    }

    // Reset failed recipients to PENDING with refreshed phone number
    for (const r of campaign.recipients) {
      const refreshedPhone =
        r.contact?.phoneNormalized && isValidPhoneNumber(r.contact.phoneNormalized)
          ? r.contact.phoneNormalized
          : r.phone;

      await prisma.broadcastRecipient.update({
        where: { id: r.id },
        data: {
          status: 'PENDING',
          phone: refreshedPhone,
          errorMessage: null,
          failedAt: null
        }
      });
    }

    await prisma.broadcastCampaign.update({
      where: { id },
      data: {
        status: 'RUNNING',
        failedCount: 0,
        completedAt: null
      }
    });

    await logAudit(req, 'RETRY_CAMPAIGN', 'BroadcastCampaign', id, {
      retriedRecipients: campaign.recipients.length
    });

    return res.json({
      success: true,
      message: `Mengulang pengiriman ${campaign.recipients.length} penerima yang gagal`
    });
  } catch (err) {
    next(err);
  }
}

export async function getCampaignRecipients(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const { status, search } = req.query;
    const where: any = { campaignId: id };

    if (status) where.status = String(status);
    if (search) {
      where.OR = [
        { phone: { contains: String(search) } },
        { contact: { name: { contains: String(search), mode: 'insensitive' } } }
      ];
    }

    const [total, recipients] = await Promise.all([
      prisma.broadcastRecipient.count({ where }),
      prisma.broadcastRecipient.findMany({
        where,
        skip,
        take: limit,
        include: { contact: { select: { name: true, phoneNormalized: true } } },
        orderBy: { queuedAt: 'desc' }
      })
    ]);

    return res.json({
      success: true,
      data: recipients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function exportCampaignReport(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const campaign = await prisma.broadcastCampaign.findUnique({
      where: { id },
      include: { recipients: { include: { contact: true } } }
    });

    if (!campaign) {
      throw new AppError('Kampanye tidak ditemukan', 404);
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Laporan Broadcast');

    sheet.columns = [
      { header: 'Nama Kontak', key: 'name', width: 25 },
      { header: 'Nomor WhatsApp', key: 'phone', width: 20 },
      { header: 'Status Pengiriman', key: 'status', width: 18 },
      { header: 'Pesan Terkirim', key: 'message', width: 45 },
      { header: 'Waktu Terkirim', key: 'sentAt', width: 20 },
      { header: 'Keterangan Error', key: 'error', width: 30 }
    ];

    sheet.getRow(1).font = { bold: true };

    for (const r of campaign.recipients) {
      sheet.addRow({
        name: sanitizeForExcel(r.contact?.name || '-'),
        phone: sanitizeForExcel(r.phone),
        status: sanitizeForExcel(r.status),
        message: sanitizeForExcel(r.personalizedMessage || '-'),
        sentAt: r.sentAt ? r.sentAt.toISOString() : '-',
        error: sanitizeForExcel(r.errorMessage || '-')
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="laporan-broadcast-${id}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

// Templates CRUD
export async function listTemplates(_req: Request, res: Response, next: NextFunction) {
  try {
    const templates = await prisma.broadcastTemplate.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
}

export async function createTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, category, content, variables = [] } = req.body;
    if (!name || !content) {
      throw new AppError('Nama dan konten template wajib diisi', 400);
    }

    const template = await prisma.broadcastTemplate.create({
      data: {
        name,
        category: category || 'GENERAL',
        content,
        variables,
        createdById: req.user!.id
      }
    });

    return res.status(201).json({ success: true, data: template });
  } catch (err) {
    next(err);
  }
}

export async function deleteTemplate(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    await prisma.broadcastTemplate.delete({ where: { id } });
    return res.json({ success: true, message: 'Template berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}
