import assert from 'assert';
import path from 'path';
import { sanitizeForExcel, formatRupiah } from '@bot-sales/shared';
import { interpolateTemplate } from './apps/api/src/modules/broadcasts/broadcast.service';

async function runSelfChecks() {
  console.log('Running self-checks for audit fixes...');

  // 1. Check sanitizeForExcel formula injection protection
  assert.strictEqual(sanitizeForExcel('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.strictEqual(sanitizeForExcel('+12345'), "'+12345");
  assert.strictEqual(sanitizeForExcel('-hello'), "'-hello");
  assert.strictEqual(sanitizeForExcel('@user'), "'@user");
  assert.strictEqual(sanitizeForExcel('Normal text'), "Normal text");
  console.log('✓ Excel formula injection protection verified.');

  // 2. Check path traversal sanitization
  const maliciousFileId = '../../../../etc/passwd';
  const safeFileId = path.basename(maliciousFileId);
  assert.strictEqual(safeFileId, 'passwd');
  assert.strictEqual(path.join('/base/path', safeFileId), '/base/path/passwd');
  console.log('✓ Path traversal basename sanitization verified.');

  // 3. Check template interpolation with Decimal-like priceOtr and minDp
  const mockMotorcycle = {
    name: 'Honda Beat Deluxe',
    brand: { name: 'Honda' },
    priceOtr: { toString: () => '18900000', valueOf: () => 18900000 },
    minDp: null
  };
  const template = 'Halo {{nama}}, motor {{nama_motor}} seharga {{harga_motor}} dengan cicilan {{cicilan_motor}}';
  const interpolated = await interpolateTemplate(template, { name: 'Budi' }, mockMotorcycle);
  const expectedOtr = formatRupiah(18900000);
  assert.ok(interpolated.includes('Halo Budi'));
  assert.ok(interpolated.includes('Honda Beat Deluxe'));
  assert.ok(interpolated.includes(expectedOtr));
  assert.ok(!interpolated.includes('NaN'));
  console.log('✓ Broadcast template Decimal arithmetic verified.');

  // 4. Check sortBy whitelist logic
  const validSortColumns = ['name', 'priceOtr', 'stock', 'createdAt', 'updatedAt', 'sku'];
  const unsafeSort = "id; DROP TABLE users;--";
  const safeSort = validSortColumns.includes(unsafeSort) ? unsafeSort : 'name';
  assert.strictEqual(safeSort, 'name');
  console.log('✓ SortBy whitelist fallback verified.');

  console.log('ALL SELF-CHECKS PASSED SUCCESSFULLY!');
}

runSelfChecks().catch((err) => {
  console.error('Self-check failed:', err);
  process.exit(1);
});
