import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import ExcelJS from 'exceljs';
import { sanitizeForExcel, formatRupiah } from '@bot-sales/shared';
import { logAudit } from '../../utils/audit';

export async function exportMotorcycles(req: Request, res: Response, next: NextFunction) {
  try {
    const motors = await prisma.motorcycle.findMany({
      include: { brand: true },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Katalog Motor');

    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 16 },
      { header: 'Nama Motor', key: 'name', width: 25 },
      { header: 'Merek', key: 'brand', width: 15 },
      { header: 'Model', key: 'model', width: 18 },
      { header: 'Tahun', key: 'year', width: 10 },
      { header: 'Kategori', key: 'category', width: 15 },
      { header: 'Kondisi', key: 'condition', width: 12 },
      { header: 'Harga OTR (Rp)', key: 'priceOtr', width: 18 },
      { header: 'DP Minimum (Rp)', key: 'minDp', width: 18 },
      { header: 'Status Stok', key: 'stockStatus', width: 15 },
      { header: 'Aktif', key: 'isActive', width: 10 }
    ];

    sheet.getRow(1).font = { bold: true };

    for (const m of motors) {
      sheet.addRow({
        sku: sanitizeForExcel(m.sku),
        name: sanitizeForExcel(m.name),
        brand: sanitizeForExcel(m.brand.name),
        model: sanitizeForExcel(m.model),
        year: m.year,
        category: sanitizeForExcel(m.category),
        condition: m.condition,
        priceOtr: Number(m.priceOtr),
        minDp: m.minDp ? Number(m.minDp) : 0,
        stockStatus: m.stockStatus,
        isActive: m.isActive ? 'Ya' : 'Tidak'
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    await logAudit(req, 'EXPORT_MOTORCYCLES', 'Export', null, { count: motors.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="katalog-motor.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

export async function exportContacts(req: Request, res: Response, next: NextFunction) {
  try {
    const contacts = await prisma.contact.findMany({
      include: { contactTags: { include: { tag: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Kontak');

    sheet.columns = [
      { header: 'Nama', key: 'name', width: 25 },
      { header: 'Nomor WhatsApp', key: 'phone', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Tag', key: 'tags', width: 25 },
      { header: 'Sumber', key: 'source', width: 16 },
      { header: 'Minat Motor', key: 'interested', width: 20 },
      { header: 'Status Persetujuan', key: 'consent', width: 18 },
      { header: 'Opt-Out', key: 'optOut', width: 12 },
      { header: 'Catatan', key: 'notes', width: 30 }
    ];

    sheet.getRow(1).font = { bold: true };

    for (const c of contacts) {
      sheet.addRow({
        name: sanitizeForExcel(c.name),
        phone: sanitizeForExcel(c.phoneNormalized),
        email: sanitizeForExcel(c.email || ''),
        tags: sanitizeForExcel(c.contactTags.map((t) => t.tag.name).join(', ')),
        source: sanitizeForExcel(c.source),
        interested: sanitizeForExcel(c.interestedMotorcycle || ''),
        consent: c.consentStatus,
        optOut: c.isOptOut ? 'Ya' : 'Tidak',
        notes: sanitizeForExcel(c.internalNotes || '')
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    await logAudit(req, 'EXPORT_CONTACTS', 'Export', null, { count: contacts.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="data-kontak.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

export async function exportLeads(req: Request, res: Response, next: NextFunction) {
  try {
    const leads = await prisma.lead.findMany({
      include: { motorcycle: true, assignedSales: true },
      orderBy: { createdAt: 'desc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Data Leads');

    sheet.columns = [
      { header: 'Nama Pelanggan', key: 'name', width: 25 },
      { header: 'Nomor HP', key: 'phone', width: 18 },
      { header: 'Motor Diminati', key: 'motor', width: 22 },
      { header: 'Budget (Rp)', key: 'budget', width: 16 },
      { header: 'Rencana DP (Rp)', key: 'dp', width: 16 },
      { header: 'Rencana Tenor', key: 'tenor', width: 14 },
      { header: 'Status Lead', key: 'status', width: 18 },
      { header: 'Sales PIC', key: 'sales', width: 20 },
      { header: 'Catatan', key: 'notes', width: 30 },
      { header: 'Tanggal Dibuat', key: 'createdAt', width: 20 }
    ];

    sheet.getRow(1).font = { bold: true };

    for (const l of leads) {
      sheet.addRow({
        name: sanitizeForExcel(l.customerName),
        phone: sanitizeForExcel(l.phone),
        motor: sanitizeForExcel(l.motorcycle?.name || '-'),
        budget: l.budget ? Number(l.budget) : 0,
        dp: l.dpPlanned ? Number(l.dpPlanned) : 0,
        tenor: l.tenorPlanned ? `${l.tenorPlanned} bln` : '-',
        status: l.status,
        sales: sanitizeForExcel(l.assignedSales?.name || '-'),
        notes: sanitizeForExcel(l.notes || ''),
        createdAt: l.createdAt.toISOString().split('T')[0]
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    await logAudit(req, 'EXPORT_LEADS', 'Export', null, { count: leads.length });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="data-leads.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}
