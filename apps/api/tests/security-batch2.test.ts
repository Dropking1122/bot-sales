import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Security fixes from the audit's Batch 2 (role and ownership gates). The gate function itself is
// exercised for real against the built output; the owner-scope handlers are asserted at source
// level because reaching them would need a seeded database.
// Runs against the built output (npm run build): no DB, no network.

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = (p: string) => fs.readFileSync(path.join(apiRoot, 'src', p), 'utf8');

test('requireRoles denies SALES and admits ADMIN at runtime', () => {
  // The middleware module imports config/env, so hand the child a valid environment.
  const script = `
    const { requireRoles } = require('./dist/middleware/auth.js');
    const { AdminRole } = require('@prisma/client');
    const gate = requireRoles(AdminRole.SUPER_ADMIN, AdminRole.ADMIN);
    const call = (role) => {
      let status = null, nexted = false;
      const res = { status(c) { status = c; return this; }, json() { return this; } };
      gate({ user: { id: 'u1', email: 'e', name: 'n', role } }, res, () => { nexted = true; });
      return { status, nexted };
    };
    console.log(JSON.stringify({ sales: call(AdminRole.SALES), admin: call(AdminRole.ADMIN) }));
  `;
  const out = execFileSync(process.execPath, ['-e', script], {
    cwd: apiRoot,
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME || '/root',
      DATABASE_URL: 'postgresql://u:p@127.0.0.1:5432/d',
      JWT_SECRET: 'a'.repeat(64)
    },
    encoding: 'utf8'
  });
  const got = JSON.parse(out);
  assert.deepEqual(got.sales, { status: 403, nexted: false }, 'SALES must be refused');
  assert.deepEqual(got.admin, { status: null, nexted: true }, 'ADMIN must pass through');
});

test('SALES-visible surfaces are scoped, admin-only surfaces are gated', () => {
  const settings = src('modules/settings/settings.routes.ts');
  assert.match(settings, /router\.get\('\/', authenticate, requireRoles\(AdminRole\.SUPER_ADMIN, AdminRole\.ADMIN\), getSettings\)/);
  assert.match(settings, /router\.get\('\/public', getPublicSettings\)/, 'public branding must stay public');

  const wa = src('modules/whatsapp/whatsapp.controller.ts');
  assert.match(wa, /qrCode: null, qrImage: null/, 'the pairing QR must be stripped for non-admins');

  const conv = src('modules/conversations/conversations.controller.ts');
  const guards = conv.match(/await assertConversationAccess\(req, id\)/g) || [];
  assert.equal(guards.length, 6, 'every conversation-id handler must check ownership');
  assert.match(conv, /assignedToAdminId: null/, 'the unassigned queue must stay reachable for reps');

  const leads = src('modules/leads/leads.controller.ts');
  assert.match(leads, /where\.assignedSalesId = req\.user\?\.id/, 'SALES list must be self-scoped');
  assert.match(leads, /existing\.assignedSalesId !== req\.user\?\.id/, 'cross-rep updates must 404');

  const imports = src('modules/imports/import.controller.ts');
  const jobChecks = imports.match(/job\.createdById !== req\.user\?\.id/g) || [];
  assert.equal(jobChecks.length, 2, 'both the job read and the shared error reader must check ownership');

  const dash = src('modules/dashboard/dashboard.controller.ts');
  const auditGates = dash.match(/isAuditReader\(req\)/g) || [];
  assert.equal(auditGates.length, 2, 'both dashboard handlers must gate audit rows');
});
