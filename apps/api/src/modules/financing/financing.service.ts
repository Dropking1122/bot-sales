import { FinancingSimulationRequest, FinancingSimulationResult, formatRupiah } from '@bot-sales/shared';
import { prisma } from '../../config/db';

export function parseIndonesianNumber(raw: string): number | null {
  if (!raw) return null;
  let s = raw.toLowerCase().trim();

  // Remove currency prefixes
  s = s.replace(/^(rp\.?|idr)\s*/i, '');

  // Check for 'juta' or 'jt'
  const jtMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:jt|juta)$/i);
  if (jtMatch) {
    const val = parseFloat(jtMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000_000);
  }

  // Check for 'ribu' or 'rb' or 'k'
  const rbMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:rb|ribu|k)$/i);
  if (rbMatch) {
    const val = parseFloat(rbMatch[1].replace(',', '.'));
    if (!isNaN(val)) return Math.round(val * 1_000);
  }

  // Clean dots used as thousand separators (e.g. 27.500.000)
  // Or commas used as thousand separators (e.g. 27,500,000)
  const cleanDots = s.replace(/\./g, '').replace(/,/g, '');
  const parsed = parseInt(cleanDots, 10);
  if (!isNaN(parsed) && parsed > 0) {
    return parsed;
  }

  return null;
}

export async function calculateFinancing(params: FinancingSimulationRequest): Promise<FinancingSimulationResult> {
  const {
    hargaOtr,
    dpAmount,
    tenorMonths,
    interestRateAnnual = 8.5,
    adminFee = 500000,
    insuranceFee = 350000
  } = params;

  if (dpAmount >= hargaOtr) {
    throw new Error('DP tidak boleh melebihi atau sama dengan harga OTR (gunakan pembelian tunai)');
  }

  const downPayment = Math.max(0, dpAmount);
  const dpPercentage = Math.round((downPayment / hargaOtr) * 100);

  // Pokok Pembiayaan = (Harga OTR - DP) + Biaya Admin + Asuransi
  const pokokHutang = (hargaOtr - downPayment) + adminFee + insuranceFee;

  // Total Bunga Flat = Pokok Hutang * (Bunga Tahunan / 100) * (Tenor Bulan / 12)
  const totalBunga = pokokHutang * (interestRateAnnual / 100) * (tenorMonths / 12);

  // Total Pinjaman yang harus dibayar
  const totalPinjaman = pokokHutang + totalBunga;

  // Angsuran per bulan dibulatkan ke ribuan terdekat
  const monthlyInstallment = Math.round((totalPinjaman / tenorMonths) / 1000) * 1000;
  const totalPayment = (monthlyInstallment * tenorMonths) + downPayment;

  return {
    hargaOtr,
    dpAmount: downPayment,
    dpPercentage,
    principalLoan: pokokHutang,
    tenorMonths,
    interestRateAnnual,
    adminFee,
    insuranceFee,
    monthlyInstallment,
    totalPayment,
    disclaimer: 'Estimasi simulasi kredit resmi dealer. Angka dapat bervariasi sesuai promo leasing dan persetujuan surveyor.'
  };
}

export interface MultiTenorItem {
  tenorMonths: number;
  monthlyInstallment: number;
  totalPayment: number;
}

export async function calculateMultiTenors(
  hargaOtr: number,
  dpAmount: number,
  tenors: number[] = [11, 17, 23, 29, 35],
  interestRateAnnual = 8.5,
  adminFee = 500000,
  insuranceFee = 350000
): Promise<{
  hargaOtr: number;
  dpAmount: number;
  dpPercentage: number;
  options: MultiTenorItem[];
}> {
  const downPayment = Math.max(0, dpAmount);
  const dpPercentage = Math.round((downPayment / hargaOtr) * 100);
  const options: MultiTenorItem[] = [];

  for (const t of tenors) {
    const res = await calculateFinancing({
      hargaOtr,
      dpAmount: downPayment,
      tenorMonths: t,
      interestRateAnnual,
      adminFee,
      insuranceFee
    });
    options.push({
      tenorMonths: t,
      monthlyInstallment: res.monthlyInstallment,
      totalPayment: res.totalPayment
    });
  }

  return {
    hargaOtr,
    dpAmount: downPayment,
    dpPercentage,
    options
  };
}

export function formatMultiTenorText(params: {
  motorName?: string;
  modelName?: string;
  motorIndex?: number;
  brandName?: string;
  hargaOtr: number;
  dpAmount: number;
  dpPercentage: number;
  options: MultiTenorItem[];
}): string {
  const numPrefix = params.motorIndex ? `[No. ${params.motorIndex}] ` : '';
  const title = params.motorName
    ? `🏍️ *SIMULASI KREDIT ${numPrefix}${params.motorName.toUpperCase()}*`
    : `📊 *HASIL SIMULASI KREDIT MOTOR*`;

  let text = `${title}\n`;
  if (params.brandName) {
    text += `Merek: ${params.brandName}\n`;
  }
  text += `\n• Harga OTR: *${formatRupiah(params.hargaOtr)}*\n` +
    `• Uang Muka (DP): *${formatRupiah(params.dpAmount)}* (${params.dpPercentage}%)\n\n` +
    `📋 *ESTIMASI ANGSURAN BULANAN:*\n`;

  for (const opt of params.options) {
    text += `• Tenor *${opt.tenorMonths} Bulan*: *${formatRupiah(opt.monthlyInstallment)}* /bln\n`;
  }

  text += `\n_Catatan: Angka di atas estimasi standar dealer. Nilai final dapat bervariasi sesuai promo leasing dan persetujuan survei._\n\n`;
  
  if (params.motorIndex) {
    text += `💡 *Ingin coba DP berbeda?*\n` +
      `Ketik: *SIMULASI ${params.motorIndex} <DP>*\n` +
      `Contoh: *SIMULASI ${params.motorIndex} 4jt*\n\n`;
  } else if (params.motorName || params.modelName) {
    const rawKw = params.modelName || params.motorName || '';
    // If motorName starts with "All New Honda " or "New Honda ", strip that
    const cleanKw = rawKw.replace(/^(all\s+new\s+|new\s+)?(honda\s+|yamaha\s+)?/i, '').trim();
    const keyword = cleanKw.split(' ')[0].toUpperCase();
    text += `💡 *Ingin coba DP berbeda?*\nKetik: *SIMULASI ${keyword} <DP>*\nContoh: *SIMULASI ${keyword} 4jt*\n\n`;
  } else {
    text += `💡 *Format Simulasi Manual:* *SIMULASI <OTR> <DP> <TENOR>*\nContoh: *SIMULASI 28jt 3jt 35*\n\n`;
  }

  text += `• Ketik *KATALOG* untuk melihat pilihan unit lainnya\n` +
    `• Ketik *SALES* untuk konsultasi & pengajuan berkas leasing langsung dengan konsultan kami! 🙏`;

  return text;
}

export function formatSimulationText(sim: FinancingSimulationResult, motorName: string): string {
  return `🏍️ *SIMULASI KREDIT ${motorName.toUpperCase()}*\n\n` +
    `• Harga OTR: ${formatRupiah(sim.hargaOtr)}\n` +
    `• Uang Muka (DP): ${formatRupiah(sim.dpAmount)} (${sim.dpPercentage}%)\n` +
    `• Tenor: ${sim.tenorMonths} Bulan\n` +
    `• Angsuran / Bulan: *${formatRupiah(sim.monthlyInstallment)}*\n\n` +
    `_Catatan: ${sim.disclaimer}_\n` +
    `Hubungi tim sales kami untuk proses pengajuan leasing cepat!`;
}
