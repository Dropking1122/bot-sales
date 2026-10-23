import ExcelJS from 'exceljs';
import fs from 'fs';
import { parse as parseCsv } from 'csv-parse/sync';
import {
  MotorcycleExcelRowSchema,
  ContactExcelRowSchema,
  normalizePhoneNumber,
  isValidPhoneNumber,
  sanitizeForExcel,
  MAX_IMPORT_ROWS
} from '@bot-sales/shared';
import { prisma } from '../../config/db';
import { logger } from '../../config/logger';

export async function generateMotorcycleTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Motor Sales Bot';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Template Motor');

  sheet.columns = [
    { header: 'sku', key: 'sku', width: 16 },
    { header: 'nama_motor', key: 'nama_motor', width: 25 },
    { header: 'merek', key: 'merek', width: 18 },
    { header: 'model', key: 'model', width: 20 },
    { header: 'tahun', key: 'tahun', width: 10 },
    { header: 'kategori', key: 'kategori', width: 16 },
    { header: 'kondisi', key: 'kondisi', width: 12 },
    { header: 'harga_otr', key: 'harga_otr', width: 18 },
    { header: 'deskripsi', key: 'deskripsi', width: 35 },
    { header: 'spesifikasi', key: 'spesifikasi', width: 35 },
    { header: 'warna', key: 'warna', width: 25 },
    { header: 'status_stok', key: 'status_stok', width: 15 },
    { header: 'status_aktif', key: 'status_aktif', width: 14 },
    { header: 'dp_minimum', key: 'dp_minimum', width: 16 },
    { header: 'tenor_tersedia', key: 'tenor_tersedia', width: 20 }
  ];

  // Header styling
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  };

  // Sample data rows
  sheet.addRow({
    sku: 'HND-VAR-160-CBS',
    nama_motor: 'Vario 160 CBS',
    merek: 'Honda',
    model: 'Vario 160',
    tahun: 2024,
    kategori: 'Matic',
    kondisi: 'BARU',
    harga_otr: 27500000,
    deskripsi: 'Honda All New Vario 160 mesin eSP+ 4-katup bertenaga',
    spesifikasi: 'Mesin 160cc 4-Valve eSP+, Rem CBS, Lampu Full LED',
    warna: 'Hitam, Merah, Biru',
    status_stok: 'TERSEDIA',
    status_aktif: 'true',
    dp_minimum: 2500000,
    tenor_tersedia: '11,23,29,35'
  });

  sheet.addRow({
    sku: 'YMH-NMX-155-ABS',
    nama_motor: 'NMAX 155 Connected ABS',
    merek: 'Yamaha',
    model: 'NMAX 155',
    tahun: 2024,
    kategori: 'Matic Maxi',
    kondisi: 'BARU',
    harga_otr: 36250000,
    deskripsi: 'Yamaha All New NMAX 155 Connected fitur Y-Connect',
    spesifikasi: 'Mesin 155cc VVA, Traction Control System, Dual ABS',
    warna: 'Matte Black, Prestige Silver',
    status_stok: 'TERSEDIA',
    status_aktif: 'true',
    dp_minimum: 3500000,
    tenor_tersedia: '11,23,29,35'
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generateContactTemplateBuffer(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Motor Sales Bot';
  const sheet = workbook.addWorksheet('Template Kontak');

  sheet.columns = [
    { header: 'nama', key: 'nama', width: 25 },
    { header: 'nomor_telepon', key: 'nomor_telepon', width: 20 },
    { header: 'email', key: 'email', width: 28 },
    { header: 'tag', key: 'tag', width: 25 },
    { header: 'sumber', key: 'sumber', width: 18 },
    { header: 'minat_motor', key: 'minat_motor', width: 25 },
    { header: 'catatan', key: 'catatan', width: 35 },
    { header: 'consent_status', key: 'consent_status', width: 18 },
    { header: 'consent_source', key: 'consent_source', width: 20 }
  ];

  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };

  sheet.addRow({
    nama: 'Budi Santoso',
    nomor_telepon: '081298765432',
    email: 'budi@example.com',
    tag: 'Matic, Follow-up',
    sumber: 'Pameran Mall',
    minat_motor: 'Vario 160 CBS',
    catatan: 'Tertarik kredit DP 3jt',
    consent_status: 'GRANTED',
    consent_source: 'Formulir Pameran'
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function readExcelOrCsvRows(filePath: string): Promise<Record<string, any>[]> {
  const isCsv = filePath.toLowerCase().endsWith('.csv');

  if (isCsv) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records: any[] = parseCsv(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    if (records.length > MAX_IMPORT_ROWS) {
      throw new Error(`Jumlah baris (${records.length}) melebihi batas maksimum ${MAX_IMPORT_ROWS}`);
    }
    return records;
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('File Excel tidak memiliki lembar kerja (worksheet)');
  }

  const rows: Record<string, any>[] = [];
  const headerMap: Record<number, string> = {};

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell, colNumber) => {
        headerMap[colNumber] = String(cell.value || '').trim().toLowerCase();
      });
      return;
    }

    if (rowNumber - 1 > MAX_IMPORT_ROWS) {
      throw new Error(`Jumlah baris melebihi batas maksimum ${MAX_IMPORT_ROWS}`);
    }

    const rowObj: Record<string, any> = {};
    let hasData = false;

    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const key = headerMap[colNumber];
      if (key) {
        let val = cell.value;
        // if rich text or formula object, extract text
        if (typeof val === 'object' && val !== null) {
          if ('result' in val) val = (val as any).result;
          else if ('text' in val) val = (val as any).text;
        }
        rowObj[key] = val;
        hasData = true;
      }
    });

    if (hasData) {
      rows.push(rowObj);
    }
  });

  return rows;
}
