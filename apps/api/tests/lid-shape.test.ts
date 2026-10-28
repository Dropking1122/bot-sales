// Runnable self-check for the LID/phone decision table. Pure logic, no DB, no network.
// Run: node --test apps/api/tests/lid-shape.test.mjs   (or via `npm test` in apps/api)
import test from 'node:test';
import assert from 'node:assert/strict';
import { isLikelyLid, isValidPhoneNumber, normalizePhoneNumber } from
  '../../../packages/shared/dist/index.js';

const REAL_LIDS = [
  ['186256256442606', 'Rey'],
  ['169372152811612', 'Wandi'],
  ['232035692085251', 'siti'],
  ['164544542425288', 'Kulub'],
  ['260678795440267', 'Gugum'],
  ['47915192082487', 'revd store']
];
const REAL_PHONES = [
  ['6288214672165', 'revd store'],
  ['6281398443917', 'Gugum'],
  ['6285691767435', 'Wandi'],
  ['6285893975849', 'siti'],
  ['6285742890312', 'Kulub'],
  ['6287780368860', 'Rey']
];

test('every stored LID is classified as a LID', () => {
  for (const [v, who] of REAL_LIDS) assert.equal(isLikelyLid(v), true, `${who} ${v}`);
});

test('every resolved phone is classified as a phone, not a LID', () => {
  for (const [v, who] of REAL_PHONES) {
    assert.equal(isLikelyLid(v), false, `${who} ${v} must not read as a LID`);
    assert.equal(isValidPhoneNumber(v), true, `${who} ${v} must be a valid phone`);
  }
});

// This is the trap that hid the numbers: isValidPhoneNumber() accepts a LID, so "is this already a
// real number?" must combine both tests. Testing it alone would skip resolution forever.
test('isValidPhoneNumber alone would misclassify a LID — the resolver guard must combine both', () => {
  for (const [v] of REAL_LIDS) assert.equal(isValidPhoneNumber(v), true, `${v} is permissive-accepted`);

  const alreadyReal = (phone) => isValidPhoneNumber(phone) && !isLikelyLid(phone);
  for (const [v] of REAL_LIDS) assert.equal(alreadyReal(v), false, `${v} must still be looked up`);
  for (const [v] of REAL_PHONES) assert.equal(alreadyReal(v), true, `${v} must skip the lookup`);
});

test('normalisation is stable on both shapes', () => {
  for (const [v] of REAL_PHONES) assert.match(normalizePhoneNumber(v), /^628\d{7,13}$/);
});
