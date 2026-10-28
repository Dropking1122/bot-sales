import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Deterministic checks for the Batch 4 remediations (handoff fan-out). Source assertions pin the
// invariants; the sanitizer and the trigger regex are also exercised for real at runtime.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => fs.readFileSync(path.join(here, '..', 'src', rel), 'utf8');

const wa = src('modules/whatsapp/whatsapp.service.ts');

test('sanitizeAlertText really flattens an attacker-shaped message', async () => {
  const mod = await import('../src/modules/whatsapp/whatsapp.service.js');
  const s = mod.sanitizeAlertText as (raw: string, maxLen?: number) => string;
  assert.equal(typeof s, 'function', 'sanitizeAlertText must be importable');

  // A message crafted to imitate the alert template and plant a link.
  const hostile = 'halo\n\n*PANGGILAN SALES*\n📍 Buka: https://evil.example.com/phish\n_buka_ ~ini~ `code`';
  const out = s(hostile);
  assert.ok(!out.includes('\n'), 'line breaks must be gone');
  assert.ok(!out.includes('http'), 'URLs must be gone');
  assert.ok(!/[*_~`]/.test(out), 'WhatsApp markup must be gone');
  assert.ok(out.includes('PANGGILAN SALES'), 'the plain text itself is kept, just neutralised');

  assert.equal(s('a'.repeat(500)).length, 303, 'output must be length-capped');
  assert.equal(s(undefined as unknown as string), '', 'undefined must not throw');

  // The trigger regex, exercised for real.
  assert.equal(mod.HANDOFF_TRIGGER_RE.test('ini 1 pcs'), false);
  assert.equal(mod.HANDOFF_TRIGGER_RE.test('mau sales'), true);
});

test('customer-controlled fields are the sanitized ones in the alert template', () => {
  const notice = wa.slice(wa.indexOf('const clientName'), wa.indexOf('for (const adm of activeSalesList)'));
  for (const field of ['clientName', 'clientPhone', 'clientMessage']) {
    assert.match(notice, new RegExp(`${field} = sanitizeAlertText\\(`), `${field} must be sanitized`);
  }
  assert.ok(!/\$\{text\}/.test(notice), 'raw customer text must not be interpolated');
});

test('the handoff trigger matches words, not substrings', () => {
  assert.match(wa, /export const HANDOFF_TRIGGER_RE = \/\\b\(sales\|admin\|cs\|manusia\|operator\)/,
    'word-boundary trigger required');
  assert.ok(!/lower\.includes\('cs'\)/.test(wa), 'bare substring trigger must be gone');

  const re = /\b(sales|admin|cs|manusia|operator)(nya|ku)?\b/;
  // the false positives the audit named
  for (const innocent of ['ini 1 pcs', 'administrasi', 'harga cash', 'bisa kirim hari ini']) {
    assert.equal(re.test(innocent), false, `"${innocent}" must not trigger a handoff`);
  }
  // the genuine requests must still work
  for (const real of ['mau sales', 'salesnya mana', 'panggil cs dong', 'bicara dengan admin', 'manusia', 'operator']) {
    assert.equal(re.test(real), true, `"${real}" must still trigger a handoff`);
  }
});

test('a handoff is notified at most once and leaves an audit trail', () => {
  assert.match(wa, /status: \{ not: 'HANDOFF' \}/,
    'the transition must be claimed, so a re-trigger changes 0 rows');
  assert.match(wa, /if \(claimed\.count > 0\)/,
    'the fan-out must be gated on the claim');
  assert.match(wa, /logAudit\(null, 'HANDOFF_NOTIFIED'/,
    'a handoff alert is security-relevant and must be audited');
});

test('the reply path re-reads bot state instead of trusting the caller', () => {
  const exec = wa.slice(wa.indexOf('private async executeBotReply'), wa.indexOf('private async resolveBotResponse'));
  assert.match(exec, /prisma\.conversation\.findUnique/, 'must re-read the conversation');
  assert.match(exec, /!live\.isBotActive \|\| live\.status === 'HANDOFF'/,
    'must skip the reply when a human has taken over');

  // the guard must sit before any reply is generated or sent
  const guardAt = exec.indexOf('findUnique');
  const genAt = exec.indexOf('resolveBotResponse(body, contact)');
  assert.ok(guardAt !== -1 && genAt !== -1 && guardAt < genAt,
    'the guard must run before the reply is generated');
});
