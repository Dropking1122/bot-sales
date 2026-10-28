import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Security fixes from the audit's Batch 3 (SSRF, media confinement, unbounded debounce, broadcast
// consent + retry idempotency, LID canonicalization). The two pure validators are exercised for
// real against the built output; the rest is asserted at source level because reaching it would
// need a live database and a WhatsApp session.
// Runs against the built output (npm run build): no DB, no network.

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => fs.readFileSync(path.join(apiRoot, 'src', p), 'utf8');

const ENV = {
  PATH: process.env.PATH,
  HOME: process.env.HOME || '/root',
  DATABASE_URL: 'postgresql://u:***@127.0.0.1:5432/d',
  JWT_SECRET: 'a'.repeat(64)
};

test('provider allow-list rejects an unconfigured host', () => {
  const script = `
    const { isAllowedProviderUrl } = require('./dist/modules/ai/ai.service.js');
    const configured = 'http://127.0.0.1:20128/v1';
    const probe = (c) => isAllowedProviderUrl(c, configured);
    console.log(JSON.stringify({
      configured: probe('http://127.0.0.1:20128/v1'),
      metadata: probe('http://169.254.169.254/latest/meta-data'),
      public: probe('https://evil.example.com/v1'),
      file: probe('file:///etc/passwd'),
      samePortOtherPath: probe('http://127.0.0.1:20128/other')
    }));
  `;
  const got = JSON.parse(
    execFileSync(process.execPath, ['-e', script], { cwd: apiRoot, env: ENV, encoding: 'utf8' })
  );
  assert.equal(got.configured, true, 'the configured provider must stay allowed');
  assert.equal(got.metadata, false, 'cloud metadata must be refused');
  assert.equal(got.public, false, 'an arbitrary public host must be refused');
  assert.equal(got.file, false, 'non-http protocols must be refused');
  assert.equal(got.samePortOtherPath, true, 'allow-list is by origin, path may vary');
});

test('media confinement rejects paths outside storage/uploads', () => {
  const script = `
    const { confineMediaPath } = require('./dist/modules/whatsapp/whatsapp.service.js');
    console.log(JSON.stringify({
      inside: confineMediaPath('/root/bot-sales/storage/uploads/adv-160-solid-black-cbs.png'),
      nested: confineMediaPath('/root/bot-sales/storage/uploads/motorcycles/adv-160-solid-black-cbs.png'),
      escape: confineMediaPath('/root/bot-sales/storage/uploads/../../../.env'),
      absolute: confineMediaPath('/etc/passwd'),
      rootItself: confineMediaPath('/root/bot-sales/storage/uploads'),
      empty: confineMediaPath('')
    }));
  `;
  const got = JSON.parse(
    execFileSync(process.execPath, ['-e', script], { cwd: apiRoot, env: ENV, encoding: 'utf8' })
  );
  assert.ok(got.inside, 'a direct uploads file must be admitted');
  assert.ok(got.nested, 'a file in an uploads subdirectory must be admitted');
  assert.equal(got.escape, null, "'../' escapes must be refused");
  assert.equal(got.absolute, null, 'absolute host paths must be refused');
  assert.equal(got.rootItself, null, 'the uploads root itself is not a file');
  assert.equal(got.empty, null, 'an empty value must be refused');
});

test('the SSRF surface is allow-listed on both read and write paths', () => {
  const ai = src('modules/ai/ai.service.ts');
  assert.match(ai, /export function isAllowedProviderUrl/, 'the allow-list must be a pure function');
  assert.match(ai, /await isAllowedProviderHost\(providerUrl\)/, 'the test endpoint must consult it');
  assert.match(ai, /Provider AI menolak permintaan \(HTTP \$\{res\.status\}\)/, 'the upstream body must not be reflected');
  assert.doesNotMatch(ai, /error: `Upstream error \(\$\{res\.status\}\): \$\{errText\}`/);

  const settings = src('modules/settings/settings.controller.ts');
  assert.match(settings, /if \(next && !isAllowedProviderUrl\(next, current\?\.value \|\| ''\)\)/, 'the write path must validate ai_provider_url');
});

test('media resolution can only yield a path inside uploads', () => {
  const wa = src('modules/whatsapp/whatsapp.service.ts');
  const resolve = wa.slice(wa.indexOf('public resolveLocalMediaPath'), wa.indexOf('public normalizeChatJid'));
  // Strip the explanatory comments: the words being probed for are named in them.
  const code = resolve.replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\/root\/bot-sales\/storage/, 'no hard-coded host path probe');
  assert.doesNotMatch(code, /process\.cwd\(\)/, 'no cwd-relative probe');
  assert.doesNotMatch(code, /\.\./, 'no parent-directory probe');
  assert.doesNotMatch(code, /fs\.existsSync\(relOrAbsUrl\)/, 'the raw request value must not be probed directly');
  assert.match(code, /confineMediaPath\(cand\)/, 'each candidate must be confined');
});

test('debounce buffering is bounded in volume, peers and time', () => {
  const wa = src('modules/whatsapp/whatsapp.service.ts');
  for (const name of ['MAX_DEBOUNCE_TEXTS', 'MAX_DEBOUNCE_CHARS', 'MAX_DEBOUNCE_PEERS', 'DEBOUNCE_HOLD_MS']) {
    assert.match(wa, new RegExp(`export const ${name} = \\d+`), `${name} must be defined`);
  }
  assert.match(wa, /this\.debounceBuffers\.size >= MAX_DEBOUNCE_PEERS/, 'the peer map must be capped');
  assert.match(wa, /existing\.firstAt \+ DEBOUNCE_HOLD_MS - Date\.now\(\)/, 'the hold must expire from the first message');
  assert.match(wa, /\.slice\(0, MAX_DEBOUNCE_CHARS\)/, 'the merged prompt must be capped');
});

test('broadcast consent is an invariant and retries are idempotent', () => {
  const svc = src('modules/broadcasts/broadcast.service.ts');
  assert.match(svc, /consentStatus: 'GRANTED'/, 'the audience must be consent-filtered');
  assert.match(svc, /isOptOut: false/, 'opt-out must be filtered');

  const ctrl = src('modules/broadcasts/broadcast.controller.ts');
  assert.match(ctrl, /const resolvedPhone = waManager\.isLikelyLid/, 'a LID must not be snapshotted as a phone');
  assert.match(ctrl, /if \(r\.retryCount >= MAX_SEND_ATTEMPTS\) \{[\s\S]{0,80}continue/, 'exhausted recipients must not be requeued');
  assert.match(ctrl, /if \(requeued === 0\)/, 'an empty retry must not start the campaign');

  const worker = src('jobs/broadcastWorker.ts');
  assert.match(worker, /pendingRecipient\.contact\.consentStatus !== 'GRANTED'/, 'consent must be re-checked at send time');
  assert.match(worker, /export const MAX_SEND_ATTEMPTS = \d+/, 'the attempt ceiling must be exported');
  assert.match(worker, /normalizedIsLid/, 'LID detection must precede the phone check');
  // A restart must not re-send: a row left SENDING is an unknown outcome, not a pending one.
  assert.match(worker, /where: \{ status: 'SENDING' \}[\s\S]{0,120}status: 'FAILED'/, 'orphaned SENDING rows must not be reset to PENDING');
});

test('the LID resolver is offered every LID contact, not just 260/479 ones', () => {
  const wa = src('modules/whatsapp/whatsapp.service.ts');
  const sync = wa.slice(wa.indexOf('public async syncLidContactsToPhone'), wa.indexOf('public async handleIncomingMessage'));
  assert.doesNotMatch(sync, /startsWith: '260'/, 'the 260 prefix filter must be gone');
  assert.doesNotMatch(sync, /startsWith: '479'/, 'the 479 prefix filter must be gone');
  assert.match(sync, /internalNotes: \{ contains: '\[LID:' \}/, 'the recorded LID note is the selection key');
  // The recorded note must win over `phone`: after an upgrade `phone` holds the real number.
  assert.match(sync, /match\(\/\\\[LID:/, 'the LID must be read back from internalNotes');
  // The sync runs on every reconnect, so the note append has to be conditional or it accumulates.
  assert.match(sync, /alreadyNoted/, 'the note append must be guarded against re-sync');
  // ...and a contact that already holds a real number must not be re-looked-up on every reconnect.
  assert.match(sync, /alreadyReal/, 'an upgraded contact must not be re-resolved forever');
});

test('a LID is canonicalised once, by shape, everywhere', () => {
  const wa = src('modules/whatsapp/whatsapp.service.ts');

  // Exactly one definition exists, and it is the shared one the SPA also imports. The manager must
  // delegate rather than keep a second copy that could drift from the badge.
  const shared = fs.readFileSync(
    path.join(__dirname, '..', '..', '..', 'packages', 'shared', 'src', 'constants', 'index.ts'),
    'utf8'
  );
  const sharedFn = shared.slice(shared.indexOf('export function isLikelyLid'));
  assert.match(sharedFn, /\/\^\\d\{14,16\}\$\/\.test\(v\)/, 'a LID is 14-16 digits');
  assert.doesNotMatch(sharedFn, /startsWith\('260'\)/, 'prefix tests must not shadow real +260 numbers');

  const fn = wa.slice(wa.indexOf('public isLikelyLid'), wa.indexOf('public normalizeChatJid'));
  assert.match(fn, /isLikelyLidShape\(value\)/, 'the manager must delegate to the shared definition');
  assert.doesNotMatch(fn, /\d\{14,16\}/, 'the manager must not keep its own copy of the shape rule');

  // The SPA must not re-implement the predicate either: three different definitions of "LID"
  // (sync used prefixes, the badge used 1/2/4 + length) is what hid the missing numbers.
  for (const page of ['ContactsPage.tsx', 'InboxPage.tsx']) {
    const ui = fs.readFileSync(path.join(__dirname, '..', '..', 'web', 'src', 'pages', page), 'utf8');
    assert.match(ui, /import \{ isLikelyLid \} from '@bot-sales\/shared'/, `${page} must use the shared predicate`);
    assert.doesNotMatch(ui, /startsWith\('1'\)|startsWith\('2'\)|startsWith\('4'\)/, `${page} must not re-implement the LID test`);
  }

  const normalize = wa.slice(wa.indexOf('public normalizeChatJid'), wa.indexOf('public normalizeChatJid') + 600);
  assert.ok(
    normalize.indexOf('isLikelyLid(chatId)') < normalize.indexOf('normalizePhoneNumber(chatId)'),
    'the shape test must run before phone normalization'
  );

  const conv = src('modules/conversations/conversations.controller.ts');
  assert.match(conv, /waManager\.isLikelyLid\(conv\.contact\.phoneNormalized \|\| ''\)/, 'manual replies must route a LID to @lid');
  assert.match(conv, /`\$\{conv\.contact\.phoneNormalized\}@lid`/);
});
