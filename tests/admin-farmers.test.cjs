/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-farmers.test.cjs
// Phase A7: the farmers list's filters, bulk suspend, safe export and role abilities.
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
const local = globalThis.window.localStorage;

const {
  farmerAbilities,
  farmerCountSummary,
  filterFarmers,
} = require('../lib/admin/farmer-list.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { scoreLabel } = require('../lib/calculations/credit-score.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { authService, SUSPENDED_MESSAGE } = require('../services/auth.service.ts');

const params = (query) => new URLSearchParams(query);
let farmers;

test('setup: sign in and load the farmers', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'Harvest#2026!');
  farmers = await farmersService.list();
  assert.equal(farmerCountSummary(farmers), '60 farmers · 51 active · 3 suspended · 6 pending');
});

test('Northern + Maize + score below 500 matches a manual filter, and survives a refresh', () => {
  const url = '?region=Northern&crop=Maize&band=building';
  const result = filterFarmers(farmers, params(url));
  const manual = farmers.filter(
    (f) =>
      f.profile.region === 'Northern' &&
      f.profile.primaryCrops.includes('Maize') &&
      f.stats.score < 500,
  );
  assert.deepEqual(result.map((f) => f.userId).sort(), manual.map((f) => f.userId).sort());
  assert.ok(result.every((f) => scoreLabel(f.stats.score) === 'Building'));
  // A refresh re-reads the same URL, so the same filters give the same rows.
  assert.deepEqual(filterFarmers(farmers, params(url)), result);
});

test('multi-select, verification, records, dates and the overview links all filter', () => {
  const two = filterFarmers(farmers, params('?region=Northern,Ashanti'));
  assert.equal(
    two.length,
    farmers.filter((f) => ['Northern', 'Ashanti'].includes(f.profile.region)).length,
  );
  assert.ok(two.length > filterFarmers(farmers, params('?region=Northern')).length);

  const full = filterFarmers(farmers, params('?verification=full'));
  assert.ok(full.every((f) => Object.values(f.profile.verification).every(Boolean)));
  const noCard = filterFarmers(farmers, params('?verification=no-card'));
  assert.ok(noCard.length > 0 && noCard.every((f) => !f.profile.verification.ghanaCard));

  const none = filterFarmers(farmers, params('?records=no'));
  assert.ok(none.every((f) => f.stats.records === 0));
  assert.equal(none.length + filterFarmers(farmers, params('?records=yes')).length, 60);

  const day = farmers[0].createdAt.slice(0, 10);
  const sameDay = filterFarmers(farmers, params(`?joinedFrom=${day}&joinedTo=${day}`));
  assert.ok(sameDay.some((f) => f.userId === farmers[0].userId));
  assert.ok(sameDay.every((f) => f.createdAt.slice(0, 10) === day));

  // Links from the overview (phase A6).
  assert.equal(filterFarmers(farmers, params('?status=suspended&tag=appeal')).length, 2);
  assert.equal(filterFarmers(farmers, params('?region=Ashanti')).length, 9);
  const active = filterFarmers(farmers, params('?active=30'));
  assert.ok(active.length > 0 && active.length < 60);
});

test('search matches name, email, phone (either format) and farm name', () => {
  const target = farmers.find((f) => f.profile.name === 'Akosua Mensah');
  const find = (q) => filterFarmers(farmers, params(`?q=${encodeURIComponent(q)}`));
  assert.ok(find('akosua').some((f) => f.userId === target.userId));
  assert.ok(find(target.email).some((f) => f.userId === target.userId));
  assert.ok(find(target.profile.phone).some((f) => f.userId === target.userId));
  assert.ok(
    find(target.profile.phone.replace('+233', '0')).some((f) => f.userId === target.userId),
  );
  assert.ok(find(target.profile.farmName).some((f) => f.userId === target.userId));
});

test('bulk suspend of 3: one audit entry each, and none of them can sign in', async () => {
  const three = farmers.filter((f) => f.status === 'active').slice(0, 3);
  const before = readAuditLog().length;
  for (const f of three) {
    await farmersService.suspend(f.userId, 'Suspected fraud: duplicate receipts');
  }
  const added = readAuditLog().slice(before);
  assert.equal(added.length, 3);
  assert.deepEqual(
    added.map((e) => [e.action, e.targetId]),
    three.map((f) => ['farmer.suspend', f.userId]),
  );
  for (const f of three) {
    await assert.rejects(() => authService.signIn(f.email, DEMO_PASSWORDS.farmer), {
      message: SUSPENDED_MESSAGE,
    });
  }
});

test('CSV export has full profile fields, score and totals, but no secrets', async () => {
  const csv = await farmersService.exportCSV();
  const [header, ...rows] = csv.replace(/^﻿/, '').split('\r\n');
  const columns = header.split(',');
  for (const wanted of [
    'Name',
    'Email',
    'Phone',
    'Region',
    'Credit score',
    'Income (GHS)',
    'Records',
  ]) {
    assert.ok(columns.includes(wanted), `has ${wanted}`);
  }
  assert.ok(!columns.some((c) => /password|hash/i.test(c)), 'no password columns');
  assert.ok(
    !columns.some(
      (c) => /card/i.test(c) && c !== 'Ghana Card verified' && c !== 'Ghana Card status',
    ),
    'only a yes/no and the status for the Ghana Card',
  );
  assert.equal(rows.length, 60, 'one row per farmer, guests left out');

  // No stored password hash or Ghana Card digits appear anywhere in the file.
  const users = JSON.parse(local.getItem('agrictec:users'));
  for (const user of users) assert.ok(!csv.includes(user.passwordHash));
  const cardColumn = columns.indexOf('Ghana Card verified');
  assert.ok(rows.every((row) => ['Yes', 'No'].includes(row.split(',')[cardColumn])));
  const statusColumn = columns.indexOf('Ghana Card status');
  assert.ok(
    rows.every((row) =>
      ['not_provided', 'pending', 'verified', 'rejected'].includes(row.split(',')[statusColumn]),
    ),
  );
  assert.ok(!csv.includes('GHA-'), 'no card numbers');
  // A farmer's card digits never appear in their own row's text columns. (Numeric columns are
  // skipped: an income can coincidentally equal four card digits, which is not a leak.)
  const numeric = /GHS|Acres|GPS|score|Records|MoMo|Diagnoses/i;
  const textColumns = columns.map((c, i) => (numeric.test(c) ? -1 : i)).filter((i) => i >= 0);
  for (const f of farmers.filter((x) => x.profile.ghanaCard.masked)) {
    const digits = f.profile.ghanaCard.masked.replace(/\D/g, '');
    const row = rows.find((r) => r.startsWith(`${f.userId},`)).split(',');
    assert.ok(
      textColumns.every((i) => !row[i].includes(digits)),
      `${f.userId}: card digits not in the export`,
    );
  }
});

test('analysts get no checkboxes, no suspend and no reset password', () => {
  const analyst = farmerAbilities('analyst');
  assert.equal(analyst.select, false);
  assert.equal(analyst.suspend, false);
  assert.equal(analyst.resetPassword, false);
  assert.equal(analyst.addNote, false);
  assert.equal(analyst.impersonate, false);
  assert.equal(analyst.export, true, 'analysts can still export the filtered list');

  const support = farmerAbilities('support');
  assert.equal(support.select, true, 'support can tag the selected farmers');
  assert.equal(support.suspend, false);
  assert.equal(support.resetPassword, true);
  assert.equal(support.export, false);

  const admin = farmerAbilities('admin');
  assert.ok(admin.select && admin.suspend && admin.impersonate && admin.riskScan);
  assert.equal(farmerAbilities(undefined).select, false);
});

test('the quick view’s detail matches the list', async () => {
  const f = farmers.find((x) => x.stats.records >= 5);
  const detail = await farmersService.getDetail(f.userId);
  assert.equal(detail.credit.score, f.stats.score);
  assert.equal(detail.records.length, f.stats.records);
  assert.ok(detail.records.every((r, i) => i === 0 || r.date <= detail.records[i - 1].date));
  assert.equal(detail.creditConfig.version, 1);
});
