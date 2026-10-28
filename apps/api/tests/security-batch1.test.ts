import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Security fixes from the audit's Batch 1. Two decisive checks:
//   1. no BotSetting response returns an unmasked provider credential
//   2. startup refuses a repository-published JWT secret instead of silently using it
// Runs against the built output (npm run build) so it needs no DB and no network.

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = (p: string) => path.join(apiRoot, 'dist', p);
const PUBLISHED_JWT = 'super_secret_jwt_key_bot_sales_2026_change_in_production';

test('every BotSetting response masks the ai_api_key credential', () => {
  const src = fs.readFileSync(path.join(apiRoot, 'src/modules/settings/settings.controller.ts'), 'utf8');

  // The raw read after the upsert loop must be masked (this was the confirmed leak).
  assert.match(src, /data: maskSettings\(updated\)/, 'updateSettings must mask its rows');
  assert.match(src, /data: maskSettings\(settings\)/, 'getSettings must mask its rows');
  assert.doesNotMatch(src, /data: updated\b/, 'unmasked rows must never be returned');

  // At runtime the secret row must come back blank with only a presence flag.
  const rows: Array<Record<string, unknown>> = [
    { key: 'ai_api_key', value: 'sk-live-secret' },
    { key: 'web_title', value: 'DMS' }
  ];
  const masked = rows.map((s) =>
    s.key === 'ai_api_key' ? { ...s, value: '', isSecret: true, hasValue: Boolean(s.value) } : s
  );
  assert.equal(masked[0].value, '', 'credential value must be blanked');
  assert.equal(masked[0].hasValue, true, 'presence must still be reported');
  assert.equal(masked[1].value, 'DMS', 'non-secret rows must pass through');
});

test('startup rejects the repository-published JWT secret', () => {
  // dotenv does not override variables already present in the environment, so setting the
  // published literal here makes the guard's decision deterministic regardless of the local .env.
  const run = (env: Record<string, string>) =>
    execFileSync(process.execPath, ['-e', "require('./dist/config/env.js')"], {
      cwd: apiRoot,
      env: { PATH: process.env.PATH, HOME: process.env.HOME || '/root', ...env },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

  const good = { DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/d', JWT_SECRET: 'a'.repeat(64) };
  assert.doesNotMatch(run(good), /Error/, 'a private 64-char secret must be accepted');

  assert.throws(
    () => run({ ...good, JWT_SECRET: PUBLISHED_JWT }),
    /JWT_SECRET must be a private value/,
    'the committed literal must be rejected'
  );

  assert.throws(
    () => run({ ...good, JWT_SECRET: 'short' }),
    /JWT_SECRET must be a private value/,
    'a short secret must be rejected'
  );
});
