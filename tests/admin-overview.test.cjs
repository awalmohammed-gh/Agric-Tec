/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-overview.test.cjs
// Phase A6: the overview's KPIs, attention list, charts and funnel match the data.
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

const { REGIONS } = require('../constants/regions.ts');
const { farmersByRegion, scoreBuckets, scoreDistribution } = require('../lib/admin/analytics.ts');
const {
  loanStageReach,
  needsAttention,
  overviewKpis,
  regionHref,
  signupSeries,
} = require('../lib/admin/overview.ts');
const { DEFAULT_FLAGS } = require('../lib/admin/defaults.ts');
const { can } = require('../lib/admin/permissions.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { riskService } = require('../services/admin/risk.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');

let data;

test('setup: sign in and load the seeded platform', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'Harvest#2026!');
  data = {
    farmers: await farmersService.list(),
    apps: await loanApplicationsService.list(),
    flags: await riskService.list(),
    verifications: await verificationsService.list(),
  };
});

test('KPIs match a manual count (60 farmers; flags match the risk service)', async () => {
  const k = overviewKpis(data.farmers, data.apps, data.flags, data.verifications, 'all');
  const people = data.farmers.filter((f) => !f.isGuest);
  assert.equal(k.totalFarmers, 60);
  assert.equal(k.totalFarmers, people.length);
  assert.equal(k.newInRange, 60, 'all time = everyone');
  assert.equal(k.newDelta, null, 'no delta for all time');
  assert.equal(k.openFlags, (await riskService.list({ status: 'open' })).length);
  assert.equal(
    k.openHighFlags,
    (await riskService.list({ status: 'open', severity: 'high' })).length,
  );
  assert.equal(
    k.pendingVerifications,
    (await verificationsService.list({ status: 'pending' })).length,
  );
  assert.equal(k.pendingVerifications, 12);
  assert.equal(k.loanCount, 25);
  assert.equal(
    k.loanRequested,
    data.apps.reduce((s, a) => s + a.amount, 0),
  );
  // Approved ÷ decided, counted by hand.
  const approved = data.apps.filter((a) =>
    ['approved', 'disbursed', 'repaid', 'defaulted'].includes(a.status),
  ).length;
  const decided = approved + data.apps.filter((a) => a.status === 'rejected').length;
  assert.equal(k.approvalRate, Math.round((approved / decided) * 100));
  const avg = Math.round(people.reduce((s, f) => s + f.stats.score, 0) / people.length);
  assert.equal(k.averageScore, avg);
  assert.equal(k.farmersTrend.length, 12);
  assert.ok(
    k.farmersTrend.every((v, i) => i === 0 || v >= k.farmersTrend[i - 1]),
    'cumulative',
  );

  // A range compares with the period just before it.
  const month = overviewKpis(data.farmers, data.apps, data.flags, data.verifications, '30d');
  const cutoff = Date.now() - 30 * 86_400_000;
  assert.equal(month.newInRange, people.filter((f) => Date.parse(f.createdAt) >= cutoff).length);
});

test('region chart: all 16 regions, sorted; Ashanti opens the filtered farmers list', () => {
  const regions = farmersByRegion(data.farmers);
  assert.equal(regions.length, 16);
  assert.deepEqual([...regions.map((r) => r.region)].sort(), [...REGIONS].sort());
  assert.ok(regions.every((r, i) => i === 0 || r.count <= regions[i - 1].count));
  assert.equal(regions[0].region, 'Ashanti', 'the seed weights Ashanti highest');
  assert.equal(regionHref('Ashanti'), '/admin/farmers?region=Ashanti');
  assert.equal(regionHref('Greater Accra'), '/admin/farmers?region=Greater%20Accra');
});

test('needs attention: role-filtered items, appeals, and a red row for maintenance', () => {
  const base = { ...data, featureFlags: DEFAULT_FLAGS };
  const superItems = needsAttention(base, 'super_admin').map((i) => i.key);
  assert.ok(superItems.includes('risk') && superItems.includes('verifications'));
  assert.ok(superItems.includes('appeals'), 'two seeded suspended farmers appealed');
  const appeals = needsAttention(base, 'super_admin').find((i) => i.key === 'appeals');
  assert.equal(appeals.count, 2);
  assert.match(
    needsAttention(base, 'super_admin').find((i) => i.key === 'verifications').text,
    /^12 verifications pending \(oldest \d+ days?\)$/,
  );

  // Support reviews risk and verifications, but can't decide loans or reactivate farmers.
  const support = needsAttention(base, 'support').map((i) => i.key);
  assert.deepEqual(
    support.filter((k) => k === 'loans' || k === 'appeals'),
    [],
  );
  assert.ok(support.includes('risk') && support.includes('verifications'));
  // An analyst acts on none of these queues.
  assert.deepEqual(needsAttention(base, 'analyst'), []);

  const maintenance = { ...base, featureFlags: { ...DEFAULT_FLAGS, maintenanceMode: true } };
  for (const role of ['super_admin', 'support', 'analyst']) {
    const [first] = needsAttention(maintenance, role);
    assert.equal(first.key, 'maintenance', `${role} sees maintenance first`);
    assert.equal(first.urgent, true);
    assert.equal(first.actionable, role === 'super_admin', 'only settings.manage gets a link');
  }
});

test('support: report and credit links and the audit card are hidden', () => {
  assert.equal(can('support', 'reports.export'), false, 'Income Tracked → Reports link hidden');
  assert.equal(can('support', 'credit.configure'), false, 'Avg score → Credit rules link hidden');
  assert.equal(can('support', 'audit.view'), false, 'Recent admin activity card hidden');
  // Support still sees every KPI (it can load all their data)…
  for (const p of ['farmers.view', 'loans.view', 'verifications.review', 'risk.review']) {
    assert.ok(can('support', p));
  }
  // …while an analyst can't see the verification or risk KPIs.
  assert.equal(can('analyst', 'verifications.review') || can('analyst', 'risk.review'), false);
});

test('loan funnel: reach per stage from history, conversion, and side counts', () => {
  const { stages, rejected, defaulted, total } = loanStageReach(data.apps, 'all');
  assert.equal(total, 25);
  assert.deepEqual(
    stages.map((s) => [s.status, s.reached]),
    [
      ['submitted', 25],
      ['under_review', 18],
      ['approved', 12],
      ['disbursed', 9],
      ['repaid', 3],
    ],
  );
  assert.equal(stages[0].conversion, null);
  assert.equal(stages[1].conversion, Math.round((18 / 25) * 100));
  assert.equal(rejected, 4);
  assert.equal(defaulted, 2);
});

test('sign-ups series follows the range', () => {
  assert.equal(signupSeries(data.farmers, '30d').labels.length, 30);
  assert.equal(signupSeries(data.farmers, '30d').unit, 'day');
  assert.equal(signupSeries(data.farmers, '90d').unit, 'week');
  assert.equal(signupSeries(data.farmers, '12m').labels.length, 12);
  const all = signupSeries(data.farmers, 'all');
  assert.equal(
    all.counts.reduce((a, b) => a + b, 0),
    60,
    'all time counts everyone once',
  );
});

test('score bands follow the admin’s credit rules', () => {
  assert.deepEqual(
    scoreBuckets().map((b) => b.label),
    ['300–499', '500–649', '650–749', '750–850'],
  );
  assert.deepEqual(
    scoreBuckets({ fair: 450, good: 600, excellent: 720 }).map((b) => b.label),
    ['300–449', '450–599', '600–719', '720–850'],
  );
  const counts = scoreDistribution(data.farmers).map((b) => b.count);
  assert.equal(
    counts.reduce((a, b) => a + b, 0),
    60,
    'every farmer is in exactly one band',
  );
});
