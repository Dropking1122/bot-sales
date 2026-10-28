import { Request, Response, NextFunction } from 'express';
import { AdminRole } from '@prisma/client';
import { prisma } from '../../config/db';
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT } from '@bot-sales/shared';
import { AppError } from '../../middleware/errorHandler';
import { logAudit } from '../../utils/audit';

export async function listLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(req.query.limit as string, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    const { status, salesId, search } = req.query;
    const where: any = {};

    if (status) where.status = String(status);
    if (req.user?.role === AdminRole.SALES) {
      // SALES sees only its own pipeline; without this any authenticated account reads every rep's leads.
      where.assignedSalesId = req.user?.id;
    } else if (salesId) {
      where.assignedSalesId = String(salesId);
    }
    if (search) {
      where.OR = [
        { customerName: { contains: String(search), mode: 'insensitive' } },
        { phone: { contains: String(search) } }
      ];
    }

    const [total, leads] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        include: {
          motorcycle: { include: { brand: true } },
          assignedSales: { select: { id: true, name: true, email: true } },
          contact: { select: { id: true, name: true, phoneNormalized: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    return res.json({
      success: true,
      data: leads,
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

export async function createLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { contactId, motorcycleId, customerName, phone, budget, dpPlanned, tenorPlanned, status, assignedSalesId, notes, followUpDate } = req.body;

    if (!contactId || !customerName || !phone) {
      throw new AppError('contactId, customerName, dan phone wajib diisi', 400);
    }

    // A SALES rep owns whatever it creates; only admins may assign a lead to someone else.
    const ownerId =
      req.user?.role === AdminRole.SALES ? req.user?.id ?? null : assignedSalesId || req.user?.id || null;

    const lead = await prisma.lead.create({
      data: {
        contactId,
        motorcycleId: motorcycleId || null,
        customerName,
        phone,
        budget: budget ? parseFloat(budget) : null,
        dpPlanned: dpPlanned ? parseFloat(dpPlanned) : null,
        tenorPlanned: tenorPlanned ? parseInt(tenorPlanned, 10) : null,
        status: status || 'BARU',
        assignedSalesId: ownerId,
        notes: notes || null,
        followUpDate: followUpDate ? new Date(followUpDate) : null
      },
      include: {
        motorcycle: true,
        assignedSales: true
      }
    });

    await logAudit(req, 'CREATE_LEAD', 'Lead', lead.id, { customerName, phone });

    return res.status(201).json({ success: true, data: lead });
  } catch (err) {
    next(err);
  }
}

export async function updateLead(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { status, assignedSalesId, notes, followUpDate, budget, dpPlanned, tenorPlanned, motorcycleId } = req.body;

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Lead tidak ditemukan', 404);
    }

    // SALES may only touch its own pipeline and may not hand a lead to another rep.
    const isSales = req.user?.role === AdminRole.SALES;
    if (isSales && existing.assignedSalesId !== req.user?.id) {
      throw new AppError('Lead tidak ditemukan', 404);
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        status: status !== undefined ? status : undefined,
        assignedSalesId: isSales ? undefined : assignedSalesId !== undefined ? assignedSalesId : undefined,
        motorcycleId: motorcycleId !== undefined ? motorcycleId : undefined,
        notes: notes !== undefined ? notes : undefined,
        budget: budget !== undefined ? (budget ? parseFloat(budget) : null) : undefined,
        dpPlanned: dpPlanned !== undefined ? (dpPlanned ? parseFloat(dpPlanned) : null) : undefined,
        tenorPlanned: tenorPlanned !== undefined ? (tenorPlanned ? parseInt(tenorPlanned, 10) : null) : undefined,
        followUpDate: followUpDate !== undefined ? (followUpDate ? new Date(followUpDate) : null) : undefined
      },
      include: {
        motorcycle: true,
        assignedSales: true
      }
    });

    await logAudit(req, 'UPDATE_LEAD', 'Lead', id, { status, assignedSalesId });

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
