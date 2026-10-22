/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-loans.test.cjs
// Phase A10: the pipeline respects the transitions (with notes and disbursement details), the
// farmer's timeline follows, and lender changes reach the farmer app at once. All audited.
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
globalThis.window = { localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage() };
globalThis.document = { cookie: '' };

const { format, addDays } = require('date-fns');
const { readAuditLog } = require('../lib/admin/audit.ts');
const {
  deactivateBlock,
  deleteBlock,
  eligibilityChecks,
  lenderStats,
  loanFilterFns,
  loanStats,
  statusChangeSchema,
  totalCost,
} = require('../lib/admin/loan-pipeline.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { monthlyRepayment } = require('../lib/calculations/loan.ts');
const { rankOffers } = require('../components/loans/loan-offers.ts');
const { lenderFormSchema } = require('../components/admin/lenders/lender-schema.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { lendersService } = require('../services/admin/lenders.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { loansService } = require('../services/loans.service.ts');
const { useAuthStore } = require('../store/auth-store.ts');
const { usePlatformStore } = require('../store/platform-store.ts');

const STRONG = 'Harvest#2026!';
const today = format(new Date(), 'yyyy-MM-dd');

test('setup: sign in as super admin', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
});

test('stats: requested, approved, disbursed and the default rate', async () => {
  const apps = await loanApplicationsService.list();
  const stats = loanStats(apps);
  const sum = (statuses) =>
    apps.filter((a) => statuses.includes(a.status)).reduce((s, a) => s + a.amount, 0);
  assert.equal(stats.totalRequested, sum(apps.map((a) => a.status)));
  assert.equal(stats.approvedAmount, sum(['approved', 'disbursed', 'repaid', 'defaulted']));
  assert.equal(stats.disbursedAmount, sum(['disbursed', 'repaid', 'defaulted']));
  const repaid = apps.filter((a) => a.status === 'repaid').length;
  const defaulted = apps.filter((a) => a.status === 'defaulted').length;
  assert.equal(stats.defaultRate, defaulted / (repaid + defaulted));
  assert.equal(loanStats([]).defaultRate, null);

  assert.deepEqual(totalCost({ amount: 1000, monthly: 100, months: 12 }), {
    total: 1200,
    interest: 200,
  });
});

test('a submitted application can’t jump to disbursed; under review with a note reaches the farmer', async () => {
  const [submitted] = await loanApplicationsService.list({ status: 'submitted' });
  const before = readAuditLog().length;
  await assert.rejects(
    () =>
      loanApplicationsService.updateStatus(submitted.id, 'disbursed', {
        disbursedOn: today,
        disbursementRef: 'MTN-1234',
      }),
    /can’t move from Submitted to Disbursed/,
  );
  assert.equal(readAuditLog().length, before, 'refused moves leave no audit entry');

  await loanApplicationsService.updateStatus(submitted.id, 'under_review', {
    note: 'Checking records with the farmer.',
  });
  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'loan.status');
  assert.deepEqual(entry.before, { status: 'submitted' });
  assert.equal(entry.after.status, 'under_review');

  // The farmer's "My Applications" reads the same record: the new step and the note are there.
  const [mine] = (await loansService.listApplications(submitted.userId)).filter(
    (a) => a.id === submitted.id,
  );
  assert.equal(mine.status, 'under_review');
  const step = mine.history.at(-1);
  assert.equal(step.status, 'under_review');
  assert.equal(step.note, 'Checking records with the farmer.');
  assert.equal(step.by, 'Super Admin');
});

test('approve, reject and default need a note; disbursed needs a date and a reference', async () => {
  const [reviewing] = await loanApplicationsService.list({ status: 'under_review' });
  await assert.rejects(
    () => loanApplicationsService.updateStatus(reviewing.id, 'approved', { note: '' }),
    /Add a note/,
  );
  await assert.rejects(
    () => loanApplicationsService.updateStatus(reviewing.id, 'approved'),
    /Add a note/,
  );
  // The dialog uses the same rules, field by field.
  const result = statusChangeSchema(reviewing, 'approved').safeParse({ note: '' });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.error.issues.map((i) => i.path[0]),
    ['note'],
  );
  assert.equal(statusChangeSchema(reviewing, 'under_review').safeParse({}).success, false);

  const approved = await loanApplicationsService.updateStatus(reviewing.id, 'approved', {
    note: 'Records and MoMo history check out.',
  });
  assert.equal(approved.status, 'approved');

  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
  await assert.rejects(
    () =>
      loanApplicationsService.updateStatus(approved.id, 'disbursed', {
        disbursedOn: tomorrow,
        disbursementRef: 'MTN-1',
      }),
    /future/,
  );
  await assert.rejects(
    () => loanApplicationsService.updateStatus(approved.id, 'disbursed', { disbursedOn: today }),
    /transfer reference/,
  );
  const disbursed = await loanApplicationsService.updateStatus(approved.id, 'disbursed', {
    disbursedOn: today,
    disbursementRef: 'MTN-58201934',
  });
  assert.deepEqual(disbursed.disbursement, { date: today, reference: 'MTN-58201934' });
  assert.equal(disbursed.history.at(-1).disbursementRef, 'MTN-58201934');
  assert.equal(readAuditLog().at(-1).after.disbursedOn, today);

  await assert.rejects(
    () => loanApplicationsService.updateStatus(disbursed.id, 'defaulted', 'x'),
    /Add a note/,
  );
  const [stillSubmitted] = await loanApplicationsService.list({ status: 'submitted' });
  await assert.rejects(
    () => loanApplicationsService.updateStatus(stillSubmitted.id, 'rejected', '  '),
    /Add a note/,
  );
});

test('changing Sinapi to 16% reaches the farmer’s offers and repayment', async () => {
  const farmer = (await farmersService.list()).find((f) => f.status === 'active' && !f.isGuest);
  useAuthStore.setState({ session: { userId: farmer.userId, name: 'x', email: farmer.email } });
  await usePlatformStore.getState().load(farmer.userId);
  const before = usePlatformStore.getState().lenders.find((l) => l.id === 'sinapi');
  assert.equal(before.rate, 18);

  await lendersService.update('sinapi', { rate: 16 });
  assert.equal(readAuditLog().at(-1).action, 'lender.update');
  // What the farmer tab does on the storage event: refresh in place.
  await usePlatformStore.getState().refresh();
  assert.equal(usePlatformStore.getState().status, 'ready', 'no loading flash');
  const after = usePlatformStore.getState().lenders.find((l) => l.id === 'sinapi');
  assert.equal(after.rate, 16);

  const [offer] = rankOffers(10000, 12, 700, [after]);
  assert.equal(offer.partner.rate, 16);
  assert.deepEqual(offer.repayment, monthlyRepayment(10000, 16, 12));
  assert.ok(offer.repayment.monthly < monthlyRepayment(10000, 18, 12).monthly);
});

test('deactivating hides a lender from farmers, except while applications are under review', async () => {
  const apps = await loanApplicationsService.list();
  const lenders = await lendersService.list({ includeInactive: true });
  const busy = lenders.find((l) => lenderStats(apps, l.id).underReview > 0);
  const free = lenders.find((l) => l.active && lenderStats(apps, l.id).underReview === 0);
  assert.ok(busy && free, 'the seed has both kinds');

  assert.match(deactivateBlock(busy, apps), /under review/);
  await assert.rejects(() => lendersService.toggleActive(busy.id), /under review/);
  await assert.rejects(() => lendersService.update(busy.id, { active: false }), /under review/);
  assert.ok((await loansService.getPartners()).some((l) => l.id === busy.id));

  assert.equal(deactivateBlock(free, apps), null);
  await lendersService.toggleActive(free.id);
  assert.equal(readAuditLog().at(-1).action, 'lender.deactivate');
  assert.ok(!(await loansService.getPartners()).some((l) => l.id === free.id), 'hidden');
  await usePlatformStore.getState().refresh();
  assert.ok(!usePlatformStore.getState().lenders.some((l) => l.id === free.id));
  // A farmer can't apply to it either.
  await assert.rejects(
    () =>
      loanApplicationsService.create({
        userId: apps[0].userId,
        partnerId: free.id,
        amount: 1000,
        months: 6,
        purpose: 'Seeds & Fertilizer',
        monthly: 180,
        scoreAtApplication: 600,
      }),
    /not accepting/,
  );
  await lendersService.toggleActive(free.id);
});

test('deleting is only for lenders without applications; validation matches the brief', async () => {
  const apps = await loanApplicationsService.list();
  const [withApps] = await lendersService.list({ includeInactive: true });
  assert.match(deleteBlock(withApps, apps), /Deactivate it instead/);
  await assert.rejects(() => lendersService.remove(withApps.id), /Deactivate it instead/);

  const base = {
    name: 'Kumasi Growers Fund',
    rate: 12,
    maxAmount: 20000,
    minMonths: 3,
    maxMonths: 18,
    minScore: 500,
    color: '#14b8a6',
    active: true,
    description: 'Short loans for input costs.',
  };
  await assert.rejects(() => lendersService.create({ ...base, rate: 61 }), /1% to 60%/);
  await assert.rejects(() => lendersService.create({ ...base, rate: 0.5 }), /1% to 60%/);
  await assert.rejects(
    () => lendersService.create({ ...base, maxAmount: 400 }),
    /at least GHS 500/,
  );
  await assert.rejects(() => lendersService.create({ ...base, maxMonths: 61 }), /1 to 60 months/);
  await assert.rejects(
    () => lendersService.create({ ...base, minMonths: 12, maxMonths: 6 }),
    /at least the minimum/,
  );
  await assert.rejects(() => lendersService.create({ ...base, minScore: 900 }), /300 to 850/);
  await assert.rejects(
    () => lendersService.create({ ...base, name: '  sinapi   aba TRUST ' }),
    /already exists/,
  );

  const created = await lendersService.create(base);
  assert.equal(created.description, 'Short loans for input costs.');
  assert.equal(readAuditLog().at(-1).action, 'lender.create');
  await assert.rejects(
    () => lendersService.update(created.id, { name: 'Opportunity Fund' }),
    /already exists/,
  );
  assert.equal(deleteBlock(created, apps), null);
  await lendersService.remove(created.id);
  assert.equal(readAuditLog().at(-1).action, 'lender.delete');
  assert.ok(
    !(await lendersService.list({ includeInactive: true })).some((l) => l.id === created.id),
  );

  // The form's own schema reports each rule on its field.
  const schema = lenderFormSchema(['Sinapi Aba Trust']);
  const bad = schema.safeParse({
    ...base,
    name: 'SINAPI ABA TRUST',
    rate: 70,
    maxAmount: 100,
    minMonths: 10,
    maxMonths: 5,
    minScore: 200,
    color: 'green',
    description: '',
  });
  const fields = new Set(bad.error.issues.map((i) => i.path[0]));
  for (const field of ['name', 'rate', 'maxAmount', 'maxMonths', 'minScore', 'color']) {
    assert.ok(fields.has(field), `${field} is reported`);
  }
  assert.equal(schema.safeParse({ ...base, description: '' }).success, true);
});

test('the detail page re-runs eligibility with the current rules', async () => {
  const [app] = await loanApplicationsService.list({ status: 'approved' });
  const detail = await farmersService.getDetail(app.userId);
  const config = await configService.getCreditConfig();
  const lender = (await lendersService.list({ includeInactive: true })).find(
    (l) => l.id === app.partnerId,
  );
  const checks = eligibilityChecks({
    app,
    records: detail.records,
    score: detail.credit.score,
    lender,
    rules: config.eligibility,
  });
  assert.deepEqual(
    checks.map((c) => c.key),
    ['records', 'affordability', 'score', 'lender-max', 'term'],
  );
  assert.equal(checks[0].pass, detail.records.length >= config.eligibility.minRecords);
  assert.equal(checks[2].pass, detail.credit.score >= lender.minScore);

  // Stricter rules flip the result without touching the application.
  const strict = eligibilityChecks({
    app,
    records: detail.records,
    score: detail.credit.score,
    lender: { ...lender, minScore: 850 },
    rules: { ...config.eligibility, minRecords: 999 },
  });
  assert.equal(strict.find((c) => c.key === 'records').pass, false);
  assert.equal(strict.find((c) => c.key === 'score').pass, false);
});

test('table filters, CSV export (no contact details) and roles', async () => {
  const apps = await loanApplicationsService.list();
  const farmers = await farmersService.list();
  const region = new Map(farmers.map((f) => [f.userId, f.profile.region]));
  const fns = loanFilterFns((a) => region.get(a.userId));
  const big = apps.filter((a) => fns.min(a, '20000') && fns.max(a, '80000'));
  assert.ok(big.every((a) => a.amount >= 20000 && a.amount <= 80000));
  assert.ok(
    apps
      .filter((a) => fns.status(a, 'submitted,rejected'))
      .every((a) => ['submitted', 'rejected'].includes(a.status)),
  );
  const ashanti = apps.filter((a) => fns.region(a, 'Ashanti'));
  assert.ok(ashanti.every((a) => region.get(a.userId) === 'Ashanti'));

  const csv = await loanApplicationsService.exportCSV(big.map((a) => a.id));
  assert.equal(csv.trim().split('\n').length, big.length + 1);
  // (A byte-order mark first, so Excel reads the file as UTF-8.)
  assert.match(csv.split('\n')[0], /^﻿?Reference,Farmer,Region,Lender,Amount/);
  assert.ok(!/@|\+233/.test(csv), 'no emails or phone numbers');
  assert.equal(readAuditLog().at(-1).action, 'loan.export');

  // Analysts can look but not move; support can't manage lenders.
  const [submitted] = await loanApplicationsService.list({ status: 'submitted' });
  await adminAuthService.signOut();
  await adminAuthService.signIn('yaw.darko@agrictec.app', DEMO_PASSWORDS.team);
  assert.ok((await loanApplicationsService.list()).length > 0);
  await assert.rejects(
    () => loanApplicationsService.updateStatus(submitted.id, 'under_review', 'x'),
    /permission/i,
  );
  await adminAuthService.signOut();
  await adminAuthService.signIn('kofi.adjei@agrictec.app', DEMO_PASSWORDS.team);
  await assert.rejects(() => lendersService.update('sinapi', { rate: 10 }), /permission/i);
  await assert.rejects(() => lendersService.toggleActive('sinapi'), /permission/i);
});
