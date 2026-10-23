import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db';
import { AppError } from '../../middleware/errorHandler';
import {
  generateMotorcycleTemplateBuffer,
  generateContactTemplateBuffer,
  readExcelOrCsvRows
} from './import.service';
import {
  MotorcycleExcelRowSchema,
  ContactExcelRowSchema,
  normalizePhoneNumber,
  isValidPhoneNumber,
  ImportStrategy
} from '@bot-sales/shared';
import { logAudit } from '../../utils/audit';
import ExcelJS from 'exceljs';
import fs from 'fs';

export async function getMotorcycleTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await generateMotorcycleTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-motor.xlsx"');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function getContactTemplate(_req: Request, res: Response, next: NextFunction) {
  try {
    const buffer = await generateContactTemplateBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="template-import-kontak.xlsx"');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
}

export async function previewMotorcycleImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError('File Excel/CSV wajib diunggah', 400);
    }

    const rawRows = await readExcelOrCsvRows(req.file.path);
    if (rawRows.length === 0) {
      throw new AppError('File tidak memiliki baris data yang valid', 400);
    }

    // Collect all existing SKUs in DB
    const existingMotors = await prisma.motorcycle.findMany({
      select: { sku: true }
    });
    const existingSkuSet = new Set(existingMotors.map((m) => m.sku.toUpperCase()));

    // Collect all brands in DB
    const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
    const brandMap = new Map(brands.map((b) => [b.name.toLowerCase().trim(), b.id]));

    const seenSkusInFile = new Set<string>();
    const previewRows: any[] = [];
    let validCount = 0;
    let errorCount = 0;
    let conflictCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2; // +1 for 1-based, +1 for header
      const skuRaw = String(raw.sku || '').trim().toUpperCase();

      const validation = MotorcycleExcelRowSchema.safeParse(raw);

      const errors: string[] = [];
      let action: 'INSERT' | 'UPDATE' | 'CONFLICT' | 'INVALID' = 'INSERT';

      if (!skuRaw) {
        errors.push('SKU tidak boleh kosong');
      } else if (seenSkusInFile.has(skuRaw)) {
        errors.push(`SKU "${skuRaw}" duplikat di dalam file ini`);
      } else {
        seenSkusInFile.add(skuRaw);
      }

      if (!validation.success) {
        for (const issue of validation.error.issues) {
          errors.push(`${issue.path.join('.')}: ${issue.message}`);
        }
      }

      const brandName = String(raw.merek || '').toLowerCase().trim();
      if (!brandMap.has(brandName) && brandName) {
        errors.push(`Merek "${raw.merek}" belum terdaftar di sistem. Daftarkan merek terlebih dahulu.`);
      }

      if (existingSkuSet.has(skuRaw)) {
        conflictCount++;
        action = errors.length > 0 ? 'INVALID' : 'UPDATE';
      } else {
        action = errors.length > 0 ? 'INVALID' : 'INSERT';
      }

      if (errors.length > 0) {
        errorCount++;
      } else {
        validCount++;
      }

      previewRows.push({
        rowNumber: rowNum,
        sku: skuRaw || '-',
        name: raw.nama_motor || '-',
        brand: raw.merek || '-',
        priceOtr: raw.harga_otr || 0,
        status: errors.length === 0 ? 'VALID' : 'ERROR',
        action,
        errors,
        data: raw
      });
    }

    return res.json({
      success: true,
      data: {
        fileId: req.file.filename,
        totalRows: rawRows.length,
        validCount,
        errorCount,
        conflictCount,
        previewRows: previewRows.slice(0, 100) // first 100 rows for preview
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function executeMotorcycleImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileId, strategy = 'UPSERT' } = req.body;
    if (!fileId) {
      throw new AppError('fileId wajib disertakan dari tahap preview', 400);
    }

    const filePath = `${process.cwd()}/../../storage/uploads/imports/${fileId}`;
    if (!fs.existsSync(filePath)) {
      throw new AppError('File tidak ditemukan atau telah kedaluwarsa', 404);
    }

    const rawRows = await readExcelOrCsvRows(filePath);
    const brands = await prisma.brand.findMany({ select: { id: true, name: true } });
    const brandMap = new Map(brands.map((b) => [b.name.toLowerCase().trim(), b.id]));

    // Create Import Job
    const importJob = await prisma.importJob.create({
      data: {
        jobType: 'MOTORCYCLE',
        filename: fileId,
        originalName: fileId,
        status: 'PROCESSING',
        totalRows: rawRows.length,
        createdById: req.user!.id
      }
    });

    let successCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errorsToInsert: any[] = [];

    const existingMotors = await prisma.motorcycle.findMany({
      select: { id: true, sku: true }
    });
    const existingSkuMap = new Map(existingMotors.map((m) => [m.sku.toUpperCase(), m.id]));

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2;
      const skuRaw = String(raw.sku || '').trim().toUpperCase();

      const validation = MotorcycleExcelRowSchema.safeParse(raw);
      const brandId = brandMap.get(String(raw.merek || '').toLowerCase().trim());

      if (!validation.success || !brandId || !skuRaw) {
        failedCount++;
        const errMsg = !validation.success
          ? validation.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ')
          : !brandId
          ? `Merek "${raw.merek}" tidak ditemukan`
          : 'SKU kosong';

        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber: rowNum,
          rowSku: skuRaw || null,
          columnName: 'validation',
          errorMessage: errMsg,
          rawData: raw
        });

        if (strategy === 'ABORT_ON_ERROR') {
          await prisma.importJobError.createMany({ data: errorsToInsert });
          await prisma.importJob.update({
            where: { id: importJob.id },
            data: { status: 'FAILED', failedCount }
          });
          throw new AppError(`Import dibatalkan karena strategi ABORT_ON_ERROR pada baris ${rowNum}: ${errMsg}`, 400);
        }
        continue;
      }

      const val = validation.data;
      const existingId = existingSkuMap.get(skuRaw);

      try {
        if (existingId) {
          if (strategy === 'SKIP_EXISTING' || strategy === 'INSERT_ONLY') {
            skippedCount++;
            continue;
          }

          // UPDATE
          await prisma.motorcycle.update({
            where: { id: existingId },
            data: {
              name: val.nama_motor,
              brandId,
              model: val.model,
              year: val.tahun,
              category: val.kategori,
              condition: val.kondisi as any,
              priceOtr: val.harga_otr,
              description: val.deskripsi || null,
              specs: val.spesifikasi ? { detail: val.spesifikasi } : {},
              colors: val.warna ? val.warna.split(',').map((c) => c.trim()) : [],
              stockStatus: val.status_stok as any,
              isActive: val.status_aktif,
              minDp: val.dp_minimum || null,
              availableTenors: val.tenor_tersedia.split(',').map((t) => parseInt(t.trim(), 10)).filter(Boolean)
            }
          });
          updatedCount++;
        } else {
          if (strategy === 'UPDATE_ONLY') {
            skippedCount++;
            continue;
          }

          // INSERT
          await prisma.motorcycle.create({
            data: {
              sku: skuRaw,
              name: val.nama_motor,
              brandId,
              model: val.model,
              year: val.tahun,
              category: val.kategori,
              condition: val.kondisi as any,
              priceOtr: val.harga_otr,
              description: val.deskripsi || null,
              specs: val.spesifikasi ? { detail: val.spesifikasi } : {},
              colors: val.warna ? val.warna.split(',').map((c) => c.trim()) : [],
              stockStatus: val.status_stok as any,
              isActive: val.status_aktif,
              minDp: val.dp_minimum || null,
              availableTenors: val.tenor_tersedia.split(',').map((t) => parseInt(t.trim(), 10)).filter(Boolean)
            }
          });
          successCount++;
        }
      } catch (err: any) {
        failedCount++;
        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber: rowNum,
          rowSku: skuRaw,
          columnName: 'database',
          errorMessage: err.message,
          rawData: raw
        });
      }
    }

    if (errorsToInsert.length > 0) {
      await prisma.importJobError.createMany({ data: errorsToInsert });
    }

    const finalStatus = failedCount === rawRows.length ? 'FAILED' : 'COMPLETED';

    const updatedJob = await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: finalStatus,
        processedRows: rawRows.length,
        successCount,
        updatedCount,
        skippedCount,
        failedCount
      }
    });

    await logAudit(req, 'IMPORT_MOTORCYCLES', 'ImportJob', importJob.id, {
      total: rawRows.length,
      successCount,
      updatedCount,
      failedCount
    });

    return res.json({
      success: true,
      message: 'Proses import motor selesai',
      data: updatedJob
    });
  } catch (err) {
    next(err);
  }
}

export async function previewContactImport(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError('File Excel/CSV kontak wajib diunggah', 400);
    }

    const rawRows = await readExcelOrCsvRows(req.file.path);
    if (rawRows.length === 0) {
      throw new AppError('File tidak memiliki baris data', 400);
    }

    const existingContacts = await prisma.contact.findMany({
      select: { phoneNormalized: true }
    });
    const existingPhoneSet = new Set(existingContacts.map((c) => c.phoneNormalized));

    const seenPhonesInFile = new Set<string>();
    const previewRows: any[] = [];
    let validCount = 0;
    let errorCount = 0;
    let conflictCount = 0;

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2;
      const rawPhone = String(raw.nomor_telepon || '').trim();
      const normalized = normalizePhoneNumber(rawPhone);

      const validation = ContactExcelRowSchema.safeParse(raw);
      const errors: string[] = [];

      if (!isValidPhoneNumber(normalized)) {
        errors.push(`Format nomor WhatsApp tidak valid: "${rawPhone}"`);
      } else if (seenPhonesInFile.has(normalized)) {
        errors.push(`Nomor telepon duplikat di dalam file ini: ${normalized}`);
      } else {
        seenPhonesInFile.add(normalized);
      }

      if (!validation.success) {
        for (const iss of validation.error.issues) {
          errors.push(`${iss.path.join('.')}: ${iss.message}`);
        }
      }

      let action: 'INSERT' | 'UPDATE' | 'INVALID' = 'INSERT';
      if (existingPhoneSet.has(normalized)) {
        conflictCount++;
        action = errors.length > 0 ? 'INVALID' : 'UPDATE';
      } else {
        action = errors.length > 0 ? 'INVALID' : 'INSERT';
      }

      if (errors.length > 0) errorCount++;
      else validCount++;

      previewRows.push({
        rowNumber: rowNum,
        name: raw.nama || '-',
        phoneRaw: rawPhone,
        phoneNormalized: normalized,
        status: errors.length === 0 ? 'VALID' : 'ERROR',
        action,
        errors,
        data: raw
      });
    }

    return res.json({
      success: true,
      data: {
        fileId: req.file.filename,
        totalRows: rawRows.length,
        validCount,
        errorCount,
        conflictCount,
        previewRows: previewRows.slice(0, 100)
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function executeContactImport(req: Request, res: Response, next: NextFunction) {
  try {
    const { fileId, strategy = 'UPSERT' } = req.body;
    if (!fileId) {
      throw new AppError('fileId wajib disertakan', 400);
    }

    const filePath = `${process.cwd()}/../../storage/uploads/imports/${fileId}`;
    if (!fs.existsSync(filePath)) {
      throw new AppError('File tidak ditemukan', 404);
    }

    const rawRows = await readExcelOrCsvRows(filePath);

    const importJob = await prisma.importJob.create({
      data: {
        jobType: 'CONTACT',
        filename: fileId,
        originalName: fileId,
        status: 'PROCESSING',
        totalRows: rawRows.length,
        createdById: req.user!.id
      }
    });

    let successCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const errorsToInsert: any[] = [];

    const existingContacts = await prisma.contact.findMany({
      select: { id: true, phoneNormalized: true }
    });
    const existingPhoneMap = new Map(existingContacts.map((c) => [c.phoneNormalized, c.id]));

    for (let i = 0; i < rawRows.length; i++) {
      const raw = rawRows[i];
      const rowNum = i + 2;
      const rawPhone = String(raw.nomor_telepon || '').trim();
      const normalized = normalizePhoneNumber(rawPhone);

      const validation = ContactExcelRowSchema.safeParse(raw);
      if (!validation.success || !isValidPhoneNumber(normalized)) {
        failedCount++;
        const errMsg = !isValidPhoneNumber(normalized)
          ? `Nomor telepon tidak valid (${rawPhone})`
          : validation.error!.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`).join('; ');

        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber: rowNum,
          rowSku: normalized || rawPhone,
          columnName: 'validation',
          errorMessage: errMsg,
          rawData: raw
        });
        continue;
      }

      const val = validation.data;
      const existingId = existingPhoneMap.get(normalized);

      try {
        if (existingId) {
          if (strategy === 'SKIP_EXISTING' || strategy === 'INSERT_ONLY') {
            skippedCount++;
            continue;
          }

          // UPDATE
          await prisma.$transaction(async (tx) => {
            await tx.contact.update({
              where: { id: existingId },
              data: {
                name: val.nama,
                email: val.email || undefined,
                source: val.sumber || undefined,
                interestedMotorcycle: val.minat_motor || undefined,
                internalNotes: val.catatan || undefined,
                consentStatus: val.consent_status as any,
                consentSource: val.consent_source || undefined,
                consentAt: val.consent_status === 'GRANTED' ? new Date() : undefined
              }
            });

            if (val.tag) {
              const tagNames = val.tag.split(',').map((t) => t.trim()).filter(Boolean);
              for (const tagName of tagNames) {
                const tag = await tx.tag.upsert({
                  where: { name: tagName },
                  update: {},
                  create: { name: tagName }
                });
                await tx.contactTag.upsert({
                  where: { contactId_tagId: { contactId: existingId, tagId: tag.id } },
                  update: {},
                  create: { contactId: existingId, tagId: tag.id }
                });
              }
            }
          });
          updatedCount++;
        } else {
          if (strategy === 'UPDATE_ONLY') {
            skippedCount++;
            continue;
          }

          // INSERT
          await prisma.$transaction(async (tx) => {
            const created = await tx.contact.create({
              data: {
                name: val.nama,
                phone: rawPhone,
                phoneNormalized: normalized,
                email: val.email || null,
                source: val.sumber || 'IMPORT_EXCEL',
                interestedMotorcycle: val.minat_motor || null,
                internalNotes: val.catatan || null,
                consentStatus: val.consent_status as any,
                consentSource: val.consent_source || 'IMPORT',
                consentAt: val.consent_status === 'GRANTED' ? new Date() : null
              }
            });

            if (val.tag) {
              const tagNames = val.tag.split(',').map((t) => t.trim()).filter(Boolean);
              for (const tagName of tagNames) {
                const tag = await tx.tag.upsert({
                  where: { name: tagName },
                  update: {},
                  create: { name: tagName }
                });
                await tx.contactTag.create({
                  data: { contactId: created.id, tagId: tag.id }
                });
              }
            }
          });
          successCount++;
        }
      } catch (err: any) {
        failedCount++;
        errorsToInsert.push({
          importJobId: importJob.id,
          rowNumber: rowNum,
          rowSku: normalized,
          columnName: 'database',
          errorMessage: err.message,
          rawData: raw
        });
      }
    }

    if (errorsToInsert.length > 0) {
      await prisma.importJobError.createMany({ data: errorsToInsert });
    }

    const finalStatus = failedCount === rawRows.length ? 'FAILED' : 'COMPLETED';

    const updatedJob = await prisma.importJob.update({
      where: { id: importJob.id },
      data: {
        status: finalStatus,
        processedRows: rawRows.length,
        successCount,
        updatedCount,
        skippedCount,
        failedCount
      }
    });

    await logAudit(req, 'IMPORT_CONTACTS', 'ImportJob', importJob.id, {
      total: rawRows.length,
      successCount,
      updatedCount,
      failedCount
    });

    return res.json({
      success: true,
      message: 'Proses import kontak selesai',
      data: updatedJob
    });
  } catch (err) {
    next(err);
  }
}

export async function getImportJob(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { errors: true } }
      }
    });

    if (!job) {
      throw new AppError('Import job tidak ditemukan', 404);
    }

    return res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
}

export async function getImportJobErrors(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const errors = await prisma.importJobError.findMany({
      where: { importJobId: jobId },
      orderBy: { rowNumber: 'asc' },
      take: 200
    });

    return res.json({ success: true, data: errors });
  } catch (err) {
    next(err);
  }
}

export async function exportImportErrorsExcel(req: Request, res: Response, next: NextFunction) {
  try {
    const { jobId } = req.params;
    const errors = await prisma.importJobError.findMany({
      where: { importJobId: jobId },
      orderBy: { rowNumber: 'asc' }
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Error Report');

    sheet.columns = [
      { header: 'No Baris', key: 'rowNumber', width: 12 },
      { header: 'Identifier (SKU/No HP)', key: 'rowSku', width: 25 },
      { header: 'Kolom', key: 'columnName', width: 18 },
      { header: 'Alasan Error', key: 'errorMessage', width: 45 }
    ];

    sheet.getRow(1).font = { bold: true };

    for (const e of errors) {
      sheet.addRow({
        rowNumber: e.rowNumber,
        rowSku: e.rowSku || '-',
        columnName: e.columnName || '-',
        errorMessage: e.errorMessage
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="error-report-${jobId}.xlsx"`);
    return res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}
