import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhoneNumber, isValidPhoneNumber, formatRupiah, sanitizeForExcel } from '@bot-sales/shared';
import { calculateFinancing } from '../src/modules/financing/financing.service';
import { generateMotorcycleTemplateBuffer, generateContactTemplateBuffer } from '../src/modules/imports/import.service';

test('Phone Number Normalization for WhatsApp', () => {
  assert.equal(normalizePhoneNumber('08123456789'), '628123456789');
  assert.equal(normalizePhoneNumber('+62812-3456-7890'), '6281234567890');
  assert.equal(normalizePhoneNumber('81234567890'), '6281234567890');
  assert.equal(isValidPhoneNumber('081234567890'), true);
  assert.equal(isValidPhoneNumber('123'), false);
});

test('Financing Simulation Calculation', async () => {
  const result = await calculateFinancing({
    hargaOtr: 20000000,
    dpAmount: 2000000, // 10%
    tenorMonths: 12,
    interestRateAnnual: 10,
    adminFee: 500000,
    insuranceFee: 350000
  });

  assert.equal(result.hargaOtr, 20000000);
  assert.equal(result.dpAmount, 2000000);
  assert.equal(result.dpPercentage, 10);
  // Pokok = (20jt - 2jt) + 500rb + 350rb = 18,850,000
  assert.equal(result.principalLoan, 18850000);
  assert.ok(result.monthlyInstallment > 0);
  assert.ok(result.totalPayment > result.hargaOtr);
});

test('Excel Formula Injection Sanitization', () => {
  assert.equal(sanitizeForExcel('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeForExcel('+cmd|'), "'+cmd|");
  assert.equal(sanitizeForExcel('Honda Vario'), 'Honda Vario');
});

test('Excel Templates Generation', async () => {
  const motorBuffer = await generateMotorcycleTemplateBuffer();
  assert.ok(motorBuffer.length > 1000);

  const contactBuffer = await generateContactTemplateBuffer();
  assert.ok(contactBuffer.length > 1000);
});
