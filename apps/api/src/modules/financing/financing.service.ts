import { FinancingSimulationRequest, FinancingSimulationResult, formatRupiah } from '@bot-sales/shared';
import { prisma } from '../../config/db';

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

export function formatSimulationText(sim: FinancingSimulationResult, motorName: string): string {
  return `🏍️ *SIMULASI KREDIT ${motorName.toUpperCase()}*\n\n` +
    `• Harga OTR: ${formatRupiah(sim.hargaOtr)}\n` +
    `• Uang Muka (DP): ${formatRupiah(sim.dpAmount)} (${sim.dpPercentage}%)\n` +
    `• Tenor: ${sim.tenorMonths} Bulan\n` +
    `• Angsuran / Bulan: *${formatRupiah(sim.monthlyInstallment)}*\n\n` +
    `_Catatan: ${sim.disclaimer}_\n` +
    `Hubungi tim sales kami untuk proses pengajuan leasing cepat!`;
}
