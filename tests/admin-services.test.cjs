/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-services.test.cjs
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

// A browser-like localStorage and cookie jar, so the real services run unchanged.
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
globalThis.window = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
globalThis.document = { cookie: '' };
const local = globalThis.window.localStorage;

const { PermissionError } = require('../lib/admin/permissions.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { buildSeedWorld, DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { REGIONS } = require('../constants/regions.ts');
const { kpis, loanFunnel, farmersByRegion } = require('../lib/admin/analytics.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { lendersService } = require('../services/admin/lenders.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { announcementsService } = require('../services/admin/announcements.service.ts');
const { riskService } = require('../services/admin/risk.service.ts');
const { teamService } = require('../services/admin/team.service.ts');
const { auditService } = require('../services/admin/audit.service.ts');
const { backupService } = require('../services/admin/backup.service.ts');

const NEW_SUPER_PASSWORD = 'Harvest#2026';

/** Every app key except those that legitimately change between seeds (sign-ins, team, audit). */
function seedSnapshot() {
  const skip = new Set([
    `agrictec:${PLATFORM_KEYS.seeded}`,
    `agrictec:${PLATFORM_KEYS.audit}`,
    `agrictec:${PLATFORM_KEYS.auditArchive}`,
    `agrictec:${PLATFORM_KEYS.admins}`,
    'agrictec:admin-session',
    'agrictec:admin-lockout',
  ]);
  return Object.fromEntries(
    [...local.map.entries()]
      .filter(([key]) => !skip.has(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function signInAs(email, password) {
  await adminAuthService.signOut();
  return adminAuthService.signIn(email, password);
}

let initialSeed;

test('first admin login seeds ~60 farmers across all 16 regions', async () => {
  // Nothing works before an admin signs in.
  await assert.rejects(() => farmersService.list(), PermissionError);

  const session = await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  assert.equal(session.admin.role, 'super_admin');
  assert.equal(session.admin.mustChangePassword, true);
  assert.equal('passwordHash' in session.admin, false, 'the hash never leaves the service');
  initialSeed = seedSnapshot();

  // The forced password change blocks everything else until it is done.
  await assert.rejects(() => farmersService.list(), /temporary password/);
  await assert.rejects(
    () => adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'weak'),
    /Password needs/,
  );
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, NEW_SUPER_PASSWORD);

  const farmers = await farmersService.list();
  assert.ok(
    farmers.length >= 55 && farmers.length <= 65,
    `about 60 farmers (got ${farmers.length})`,
  );
  const regions = new Set(farmers.map((f) => f.profile.region));
  assert.deepEqual([...regions].sort(), [...REGIONS].sort(), 'all 16 regions present');

  const byStatus = (s) => farmers.filter((f) => f.status === s).length;
  assert.equal(byStatus('suspended'), 3);
  assert.equal(byStatus('pending_verification'), 6);
  assert.equal(byStatus('active'), farmers.length - 9);
  for (const f of farmers) {
    assert.ok(f.stats.records <= 40 + 15 && f.stats.momo <= 22, `${f.userId} data within range`);
  }
  const top = farmersByRegion(farmers)
    .slice(0, 5)
    .map((r) => r.region);
  assert.ok(top.includes('Ashanti') && top.includes('Eastern'), `weighted regions: ${top}`);

  const pending = await verificationsService.list({ status: 'pending' });
  assert.equal(pending.length, 12);
  assert.ok(
    pending.every((v) => v.kind === 'ghanaCard' && /^GHA-\*{6}\d{3}-\d$/.test(v.submittedValue)),
  );

  const apps = await loanApplicationsService.list();
  assert.equal(apps.length, 25);
  assert.ok(
    loanFunnel(apps).every((stage) => stage.count > 0),
    'every loan status is used',
  );
  assert.ok(
    apps.every((a) => a.history.at(-1).status === a.status && a.history[0].status === 'submitted'),
  );

  assert.equal((await teamService.list()).length, 5);
  const announcements = await announcementsService.list();
  assert.equal(announcements.length, 3);
  const northern = { region: 'Northern', primaryCrops: ['Maize'] };
  const accra = { region: 'Greater Accra', primaryCrops: ['Tomato'] };
  assert.equal((await announcementsService.activeFor(northern)).length, 2);
  assert.equal((await announcementsService.activeFor(accra)).length, 1);

  const summary = kpis(farmers, apps, await riskService.list(), await verificationsService.list());
  assert.equal(summary.totalFarmers, farmers.length);
  assert.equal(summary.pendingVerifications, 12);
  assert.ok(summary.averageScore >= 300 && summary.averageScore <= 850);
});

test('risk scan finds the planted cases and never duplicates flags', async () => {
  const seeded = await riskService.list();
  const rules = seeded.map((f) => f.rule);
  console.log('Seeded risk flags:', rules.join(', '));
  assert.ok(seeded.length >= 6 && seeded.length <= 12, `about 8 flags (got ${seeded.length})`);
  for (const rule of ['duplicate_momo_ref', 'burst_entries', 'shared_phone']) {
    assert.ok(rules.includes(rule), `seed found ${rule}`);
  }
  assert.equal(rules.filter((r) => r === 'shared_phone').length, 2, 'both phone accounts flagged');

  // The seed already ran the rules, so a scan finds nothing new.
  assert.equal((await riskService.runScan()).length, 0);

  // From an empty flag list, a scan finds the planted cases; a second scan adds nothing.
  local.setItem(`agrictec:${PLATFORM_KEYS.riskFlags}`, '[]');
  const found = await riskService.runScan();
  for (const rule of ['duplicate_momo_ref', 'burst_entries', 'shared_phone']) {
    assert.ok(
      found.some((f) => f.rule === rule),
      `scan found ${rule}`,
    );
  }
  assert.equal(found.length, seeded.length);
  assert.equal((await riskService.runScan()).length, 0, 'second scan adds no duplicates');
  assert.equal((await riskService.list()).length, found.length);

  // A dismissed flag stays dismissed: a later scan does not bring it back.
  await riskService.dismiss(found[0].id, 'Checked with the farmer; genuine.');
  assert.equal((await riskService.runScan()).length, 0);
});

test('invalid loan status jumps throw and are not audited', async () => {
  const [submitted] = await loanApplicationsService.list({ status: 'submitted' });
  const before = readAuditLog().length;
  await assert.rejects(
    () => loanApplicationsService.updateStatus(submitted.id, 'disbursed'),
    /can’t move from Submitted to Disbursed/,
  );
  assert.equal(readAuditLog().length, before, 'a failed action leaves no audit entry');

  const reviewed = await loanApplicationsService.updateStatus(
    submitted.id,
    'under_review',
    'Checking',
  );
  assert.equal(reviewed.status, 'under_review');
  assert.equal(reviewed.history.at(-1).by, 'Super Admin');
  assert.equal(readAuditLog().length, before + 1);
  const [repaid] = await loanApplicationsService.list({ status: 'repaid' });
  await assert.rejects(
    () => loanApplicationsService.updateStatus(repaid.id, 'approved'),
    /can’t move/,
  );
});

test('an analyst cannot suspend: PermissionError and no audit entry', async () => {
  await signInAs('yaw.darko@agrictec.app', DEMO_PASSWORDS.team);
  const [farmer] = (await farmersService.list()).filter((f) => f.status === 'active');
  const before = readAuditLog().length;
  await assert.rejects(
    () => farmersService.suspend(farmer.userId, 'Testing access'),
    PermissionError,
  );
  await assert.rejects(() => teamService.list(), PermissionError);
  await assert.rejects(() => verificationsService.list(), PermissionError);
  assert.equal(readAuditLog().length, before);
  assert.equal((await farmersService.get(farmer.userId)).status, 'active');
});

test('a super admin suspend writes exactly one audit entry with before and after', async () => {
  await signInAs(SUPER_ADMIN_EMAIL, NEW_SUPER_PASSWORD);
  const [farmer] = (await farmersService.list()).filter((f) => f.status === 'active');
  const before = readAuditLog().length;
  const account = await farmersService.suspend(farmer.userId, 'Fake receipts reported');
  assert.equal(account.status, 'suspended');

  const added = readAuditLog().slice(before);
  assert.equal(added.length, 1);
  const [entry] = added;
  assert.equal(entry.action, 'farmer.suspend');
  assert.equal(entry.actorRole, 'super_admin');
  assert.equal(entry.targetId, farmer.userId);
  assert.deepEqual(entry.before, { status: 'active' });
  assert.deepEqual(entry.after, { status: 'suspended', suspendedReason: 'Fake receipts reported' });

  const page = await auditService.list({ action: 'farmer.' });
  assert.equal(page.items[0].id, entry.id, 'newest first');
});

test('the audit log has no update or delete, and other guards hold', async () => {
  assert.deepEqual(Object.keys(auditService).sort(), ['archiveInfo', 'exportJSON', 'list']);

  // Role changes: nobody changes their own access, and a demotion takes effect at once.
  const team = await teamService.list();
  const efua = team.find((a) => a.role === 'admin');
  const owner = team.find((a) => a.role === 'super_admin');
  await teamService.changeRole(efua.id, 'super_admin');
  await signInAs(efua.email, DEMO_PASSWORDS.team);
  await assert.rejects(() => teamService.changeRole(efua.id, 'admin'), /own access/);
  await teamService.changeRole(owner.id, 'admin'); // allowed: Efua is still a super admin
  await signInAs(owner.email, NEW_SUPER_PASSWORD);
  await assert.rejects(
    () => teamService.list(),
    PermissionError,
    'demoted admin lost admins.manage',
  );
  await signInAs(efua.email, DEMO_PASSWORDS.team);
  await teamService.changeRole(owner.id, 'super_admin');
  await signInAs(owner.email, NEW_SUPER_PASSWORD);
  await teamService.changeRole(efua.id, 'admin');
  assert.equal((await adminAuthService.getSession()).admin.role, 'super_admin');

  // A lender with open applications can't be removed.
  const [open] = await loanApplicationsService.list({ status: 'submitted' });
  await assert.rejects(() => lendersService.remove(open.partnerId), /open application/);

  // Credit rules: weights must sum to 100; saving bumps the version and keeps history.
  const config = await configService.getCreditConfig();
  await assert.rejects(
    () =>
      configService.saveCreditConfig({
        ...config,
        weights: { ...config.weights, verification: 50 },
      }),
    /add up to 100/,
  );
  const v2 = await configService.saveCreditConfig({
    ...config,
    eligibility: { ...config.eligibility, minScore: 600 },
  });
  assert.equal(v2.version, config.version + 1);
  const v3 = await configService.restoreCreditVersion(config.version);
  assert.equal(v3.eligibility.minScore, config.eligibility.minScore);
  assert.equal((await configService.getCreditHistory()).length, 2);

  // Approving a Ghana Card updates the farmer's profile.
  const [request] = await verificationsService.list({ status: 'pending' });
  await verificationsService.approve(request.id);
  const verified = await farmersService.get(request.userId);
  assert.equal(verified.profile.verification.ghanaCard, true);
  assert.equal(verified.profile.ghanaCardLast4, request.submittedValue.replace(/\D/g, ''));

  // A farmer password reset returns a temporary password that never reaches the log.
  const temp = await farmersService.resetPassword(request.userId);
  assert.match(temp, /^Temp-\d{5}$/);
  assert.ok(!JSON.stringify(readAuditLog()).includes(temp));
});

test('five failed logins lock the console for five minutes', async () => {
  await adminAuthService.signOut();
  for (let i = 0; i < 4; i++) {
    await assert.rejects(() => adminAuthService.signIn(SUPER_ADMIN_EMAIL, 'wrong'), /attempt/);
  }
  await assert.rejects(
    () => adminAuthService.signIn(SUPER_ADMIN_EMAIL, 'wrong'),
    /Too many attempts\. Try again in [45]:\d\d/,
  );
  await assert.rejects(
    () => adminAuthService.signIn(SUPER_ADMIN_EMAIL, NEW_SUPER_PASSWORD),
    /Try again/,
  );
  assert.equal((await adminAuthService.isLocked()).locked, true);
  local.removeItem('agrictec:admin-lockout');
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, NEW_SUPER_PASSWORD);
});

test('the seed is identical after a reset, and backups round-trip', async () => {
  // Same day + same seed = the same world, object for object.
  assert.deepEqual(await buildSeedWorld(), await buildSeedWorld());

  await assert.rejects(() => backupService.resetDemo('yes'), /Type RESET/);
  await backupService.resetDemo('RESET');
  const after = seedSnapshot();
  assert.deepEqual(Object.keys(after), Object.keys(initialSeed));
  for (const key of Object.keys(initialSeed)) {
    assert.equal(after[key], initialSeed[key], `${key} matches the first seed`);
  }
  // The reset kept the team (still signed in, password unchanged) and the audit trail.
  assert.ok(readAuditLog().some((e) => e.action === 'farmer.suspend'));
  assert.equal(readAuditLog().at(-1).action, 'system.reset_demo');

  const json = await backupService.exportAll();
  const auditBefore = readAuditLog().length;
  await farmersService.suspend((await farmersService.list())[0].userId, 'Before restore');
  await assert.rejects(
    () => backupService.importAll('{"app":"other"}', 'IMPORT'),
    /not an AgriCtec/,
  );
  await backupService.importAll(json, 'IMPORT');
  const restored = seedSnapshot();
  for (const key of Object.keys(initialSeed)) {
    assert.equal(restored[key], initialSeed[key], `${key} restored from backup`);
  }
  assert.ok(readAuditLog().length > auditBefore, 'import never rewrites the audit trail');
});
