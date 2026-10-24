/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-system.test.cjs
// Phase A14: reports (numbers match the loans data, exports audited), team safety (invite,
// temporary password, no self-demotion, last Super Admin protected), a permanent audit log, and
// system settings that control the farmer app (flags, maintenance, plans, backup/restore, reset,
// delete all farmer data).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (specifier, ...args) {
  return resolveFilename.call(
    this,
    specifier.startsWith('@/') ? path.join(root, specifier.slice(2)) : specifier,
    ...args,
  );
};
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: filename,
    });
    module._compile(outputText, filename);
  };
}

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }
  get length() {
    return this.map.size;
  }
  key(index) {
    return [...this.map.keys()][index] ?? null;
  }
  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }
  setItem(key, value) {
    this.map.set(key, String(value));
  }
  removeItem(key) {
    this.map.delete(key);
  }
}
// jsPDF reads atob/btoa from window.
globalThis.window = {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  atob: globalThis.atob,
  btoa: globalThis.btoa,
};
globalThis.document = { cookie: '' };

const { enabledNavSections } = require('../constants/navigation.ts');
const { auditGroupOf } = require('../lib/admin/audit-groups.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { loanStats } = require('../lib/admin/loan-pipeline.ts');
const { canManageRole, can } = require('../lib/admin/permissions.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { lockReason, roleChangeDiff } = require('../lib/admin/team.ts');
const { formatGHS } = require('../lib/format.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { auditService } = require('../services/admin/audit.service.ts');
const {
  backupService,
  parsePlatformBackup,
  summarizeBackup,
} = require('../services/admin/backup.service.ts');
const { configService, readFlags } = require('../services/admin/config.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { reportsService } = require('../services/admin/reports.service.ts');
const { teamService } = require('../services/admin/team.service.ts');
const { storage } = require('../services/storage.ts');

const OWNER_PASSWORD = 'Harvest#2026!';
let owner;

test('setup: sign in as super admin (seeds the demo world)', async () => {
  const session = await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  owner = session.admin;
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, OWNER_PASSWORD);
});

// ---------- Reports ----------

test('the Loan Portfolio report matches the loans data, as CSV and PDF, and is audited', async () => {
  const apps = storage.get(PLATFORM_KEYS.loanApplications, []);
  const stats = loanStats(apps);
  const report = await reportsService.build('loans');
  const value = (label) => report.summary.find((s) => s.label === label).value;
  assert.equal(value('Applications'), String(apps.length));
  assert.equal(value('Requested'), formatGHS(stats.totalRequested));
  assert.equal(value('Disbursed'), formatGHS(stats.disbursedAmount));
  const byStatus = report.tables.find((t) => t.title === 'By status');
  assert.equal(
    byStatus.rows.reduce((n, row) => n + row[1], 0),
    apps.length,
    'every application is in one status row',
  );

  const csv = await reportsService.exportReport('loans', 'csv');
  assert.match(csv.filename, /^AgriCtec_Loan_Portfolio_\d{4}-\d{2}-\d{2}\.csv$/);
  assert.ok(csv.content.includes('Loan Portfolio'));
  assert.ok(csv.content.includes(`Applications,${apps.length}`));
  const pdf = await reportsService.exportReport('loans', 'pdf');
  assert.ok(pdf.content instanceof Blob && pdf.content.size > 1000, 'a real PDF');
  const text = Buffer.from(await pdf.content.arrayBuffer()).toString('latin1');
  assert.ok(text.includes('Internal Report') && text.includes('CONFIDENTIAL'));

  const exports = readAuditLog().filter((e) => e.action === 'report.export');
  assert.deepEqual(
    exports.map((e) => e.after),
    [
      { report: 'loans', format: 'csv' },
      { report: 'loans', format: 'pdf' },
    ],
  );
});

test('every ready-made report builds; the builder filters, previews and exports CSV', async () => {
  for (const id of ['platform', 'regions', 'loans', 'credit', 'verifications', 'risk']) {
    const report = await reportsService.build(id);
    assert.ok(report.summary.length > 0 && report.tables.length > 0, id);
  }
  const all = await reportsService.preview({ dataset: 'farmers', columns: ['name', 'region'] });
  assert.equal(all.total, 60);
  const ashanti = await reportsService.preview({
    dataset: 'farmers',
    columns: ['name', 'region'],
    region: 'Ashanti',
  });
  assert.ok(ashanti.total > 0 && ashanti.total < 60);
  assert.ok(ashanti.rows.every((row) => row[1] === 'Ashanti'));
  const records = await reportsService.preview({
    dataset: 'records',
    columns: ['date', 'amount'],
    from: '2026-01-01',
    to: '2026-03-31',
  });
  assert.ok(records.rows.every((row) => row[0] >= '2026-01-01' && row[0] <= '2026-03-31'));
  const exported = await reportsService.exportCustom({
    dataset: 'applications',
    columns: ['reference', 'amount'],
  });
  assert.equal(exported.csv.replace(/^﻿/, '').split('\r\n')[0], 'Reference,Amount (GHS)');
  assert.equal(readAuditLog().at(-1).action, 'report.export');
});

// ---------- Team ----------

let invited;

test('invite: unique email across staff and farmers, temporary password, forced change', async () => {
  const farmer = (await farmersService.list()).find((f) => !f.isGuest);
  await assert.rejects(
    () => teamService.invite('Copy Cat', farmer.email, 'support'),
    /belongs to a farmer account/,
  );
  await assert.rejects(
    () => teamService.invite('Copy Cat', SUPER_ADMIN_EMAIL, 'support'),
    /already exists/,
  );
  const result = await teamService.invite('Esi Boateng', 'esi.boateng@agrictec.app', 'support');
  invited = result;
  assert.equal(result.admin.mustChangePassword, true);
  assert.ok(result.temporaryPassword.length >= 10);
  // The temporary password is never in the log.
  assert.ok(!JSON.stringify(readAuditLog()).includes(result.temporaryPassword));

  await adminAuthService.signOut();
  const session = await adminAuthService.signIn(
    'esi.boateng@agrictec.app',
    result.temporaryPassword,
  );
  assert.equal(session.admin.mustChangePassword, true, 'forced to change it');
  assert.equal(session.admin.role, 'support');
  // Support sees the support pages only.
  assert.ok(can('support', 'verifications.review') && can('support', 'risk.review'));
  assert.ok(!can('support', 'settings.manage') && !can('support', 'admins.manage'));
  await assert.rejects(() => teamService.list(), /permission/);
  await adminAuthService.signOut();
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, OWNER_PASSWORD);
});

test('no self-demotion; the last active Super Admin is protected; role diffs are explained', async () => {
  await assert.rejects(
    () => teamService.changeRole(owner.id, 'admin'),
    /can’t change your own access/,
  );
  await assert.rejects(() => teamService.disable(owner.id), /can’t change your own access/);
  const team = await teamService.list();
  const me = team.find((a) => a.id === owner.id);
  assert.match(lockReason(me, owner.id, team, 'role'), /own access/);
  // Seen by another Super Admin, the only active one still can't be demoted or disabled.
  assert.match(lockReason(me, 'someone-else', team, 'role'), /last active Super Admin/);
  assert.match(lockReason(me, 'someone-else', team, 'disable'), /can’t be disabled/);
  assert.equal(
    canManageRole('super_admin', 'super_admin', { nextRole: 'admin', activeSuperAdmins: 1 }),
    false,
  );

  const diff = roleChangeDiff('support', 'admin');
  assert.ok(diff.gained.includes('loans.manage') && diff.lost.length === 0);

  const changed = await teamService.changeRole(invited.admin.id, 'admin');
  assert.equal(changed.role, 'admin');
  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'admin.role');
  assert.deepEqual([entry.before, entry.after], [{ role: 'support' }, { role: 'admin' }]);
});

// ---------- Audit log ----------

test('the audit log shows the invite and role change, filters by group and is read-only', async () => {
  const team = await auditService.list({ group: 'team' });
  const actions = team.items.map((e) => e.action);
  assert.ok(actions.includes('admin.invite') && actions.includes('admin.role'));
  assert.ok(team.items.every((e) => auditGroupOf(e.action) === 'team'));
  const auth = await auditService.list({ group: 'auth' });
  assert.ok(
    auth.items.every((e) =>
      ['admin.login', 'admin.logout', 'admin.password_change'].includes(e.action),
    ),
  );

  const before = readAuditLog().length;
  const csv = await auditService.exportFiltered({ group: 'team' }, 'csv');
  assert.ok(csv.content.includes('admin.invite'));
  const json = JSON.parse((await auditService.exportFiltered({ group: 'team' }, 'json')).content);
  assert.equal(json.kind, 'audit-log');
  assert.equal(readAuditLog().length, before + 2, 'each export is logged');
  assert.equal(readAuditLog().at(-1).action, 'audit.export');

  // No way to change or remove an entry.
  const methods = Object.keys(auditService);
  assert.ok(!methods.some((m) => /update|delete|remove|edit|clear/i.test(m)));
});

// ---------- System settings ----------

test('feature flags control the farmer app; maintenance can end by itself', async () => {
  const flags = await configService.getFlags();
  await configService.saveFlags({ ...flags, cropDoctor: false });
  const nav = enabledNavSections(readFlags()).flatMap((s) => s.items.map((i) => i.href));
  assert.ok(!nav.includes('/crop-doctor'), 'Crop Doctor leaves the farmer menu');
  assert.ok(nav.includes('/assistant'));
  assert.equal(readAuditLog().at(-1).action, 'settings.flags');

  const past = new Date(Date.now() - 60_000).toISOString();
  await configService.saveFlags({ ...readFlags(), maintenanceMode: true, maintenanceEndsAt: past });
  assert.equal(readFlags().maintenanceMode, false, 'ended automatically');
  const future = new Date(Date.now() + 3_600_000).toISOString();
  await configService.saveFlags({
    ...readFlags(),
    maintenanceMode: true,
    maintenanceEndsAt: future,
  });
  assert.equal(readFlags().maintenanceMode, true);
  await configService.saveFlags({ ...readFlags(), maintenanceMode: false, cropDoctor: true });
});

test('plans: the Premium price and features reach the farmer upgrade dialog', async () => {
  const plans = await configService.getPlans();
  const next = plans.map((p) =>
    p.id === 'premium' ? { ...p, priceGHS: 35, features: ['Lender sharing'] } : p,
  );
  await configService.savePlans(next);
  const premium = (await configService.getPlans()).find((p) => p.id === 'premium');
  assert.equal(premium.priceGHS, 35);
  assert.deepEqual(premium.features, ['Lender sharing']);
});

test('backup → reset the demo world → restore brings everything back', async () => {
  const farmer = (await farmersService.list()).find((f) => !f.isGuest && f.status === 'active');
  await farmersService.suspend(farmer.userId, 'Checking a duplicate account');
  const json = await backupService.exportAll();
  const summary = summarizeBackup(parsePlatformBackup(json));
  assert.equal(summary.farmers, 60);
  assert.equal(summary.applications, storage.get(PLATFORM_KEYS.loanApplications, []).length);

  await assert.rejects(() => backupService.resetDemo('reset'), /Type RESET/);
  await backupService.resetDemo('RESET');
  assert.equal((await farmersService.get(farmer.userId)).status, 'active', 'reset undid it');

  await assert.rejects(() => backupService.importAll(json, 'IMPORT'), /Type RESTORE/);
  await backupService.importAll(json, 'RESTORE');
  assert.equal((await farmersService.get(farmer.userId)).status, 'suspended', 'restored');
  // The team survives a restore (it is never in a backup).
  assert.ok((await teamService.list()).some((a) => a.email === 'esi.boateng@agrictec.app'));
});

test('delete ALL farmer data needs the phrase and the password; team and audit are kept', async () => {
  const auditBefore = readAuditLog().length;
  await assert.rejects(
    () => backupService.deleteAllFarmers('DELETE ALL', OWNER_PASSWORD),
    /Type DELETE ALL FARMERS/,
  );
  await assert.rejects(
    () => backupService.deleteAllFarmers('DELETE ALL FARMERS', 'wrong-password'),
    /password is not correct/,
  );
  const { farmers } = await backupService.deleteAllFarmers('DELETE ALL FARMERS', OWNER_PASSWORD);
  assert.equal(farmers, 60);
  assert.equal((await farmersService.list()).length, 0);
  assert.deepEqual(storage.get(PLATFORM_KEYS.loanApplications, []), []);
  assert.ok((await teamService.list()).length >= 6, 'admins kept');
  assert.ok(readAuditLog().length > auditBefore, 'audit kept (and the deletion logged)');
  assert.equal(readAuditLog().at(-1).action, 'system.delete_farmers');
});
