import assert from 'node:assert';
import { parseIndonesianNumber, calculateFinancing, calculateMultiTenors } from './financing.service';

async function runTests() {
  // Test 1: Number parsing
  assert.strictEqual(parseIndonesianNumber('25jt'), 25000000);
  assert.strictEqual(parseIndonesianNumber('2.5jt'), 2500000);
  assert.strictEqual(parseIndonesianNumber('2,5jt'), 2500000);
  assert.strictEqual(parseIndonesianNumber('500rb'), 500000);
  assert.strictEqual(parseIndonesianNumber('3.000.000'), 3000000);
  assert.strictEqual(parseIndonesianNumber('Rp 27.500.000'), 27500000);
  assert.strictEqual(parseIndonesianNumber('invalid'), null);

  // Test 2: Financing calculation
  const res = await calculateFinancing({
    hargaOtr: 20000000,
    dpAmount: 2000000,
    tenorMonths: 35,
    interestRateAnnual: 8.5
  });
  assert(res.monthlyInstallment > 0, 'Installment should be positive');
  assert.strictEqual(res.hargaOtr, 20000000);
  assert.strictEqual(res.dpAmount, 2000000);

  // Test 3: Multi-tenor calculation
  const multi = await calculateMultiTenors(20000000, 2000000, [11, 23, 35]);
  assert.strictEqual(multi.options.length, 3);
  assert.strictEqual(multi.dpPercentage, 10);
  assert(multi.options[0].monthlyInstallment > multi.options[2].monthlyInstallment, 'Shorter tenor has higher monthly payment');

  console.log('✓ All financing and simulation tests passed successfully!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
