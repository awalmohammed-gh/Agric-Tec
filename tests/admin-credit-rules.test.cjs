/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-credit-rules.test.cjs
// Phase A11: credit rules are edited as a draft (nothing live changes), previewed on every
// farmer, published with a note as a new version, and restorable without rewriting history.
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

const { readAuditLog } = require('../lib/admin/audit.ts');
const {
  configChanges,
  configValues,
  draftIssues,
  impactOf,
  isPublishable,
  meetsEligibility,
  weightTotal,
} = require('../lib/admin/credit-rules.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const {
  calculateCreditScore,
  factorPoints,
  factorsFromCounts,
  scoreFromFactors,
} = require('../lib/calculations/credit-score.ts');
const { DEFAULT_CREDIT_CONFIG } = require('../lib/admin/defaults.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { storage } = require('../services/storage.ts');

const STRONG = 'Harvest#2026!';
const clone = (value) => JSON.parse(JSON.stringify(value));

test('setup: sign in as super admin', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
});

test('the draft is validated: weights total 100, rising bands within 300–850, sane limits', async () => {
  const live = configValues(await configService.getCreditConfig());
  assert.deepEqual(draftIssues(live), {});

  const off = clone(live);
  off.weights.paymentHistory -= 5;
  assert.equal(weightTotal(off.weights), 95);
  assert.equal(draftIssues(off).weights, 'Total is 95%. Must be 100%.');
  assert.equal(isPublishable(off), false);

  const bands = clone(live);
  bands.bands.good = bands.bands.fair - 1;
  assert.match(draftIssues(bands).bands, /Fair < Good < Excellent/);
  bands.bands = { fair: 300, good: 600, excellent: 700 };
  assert.match(draftIssues(bands).bands, /between 301 and 850/);
  bands.bands = { fair: 500, good: 650, excellent: 851 };
  assert.match(draftIssues(bands).bands, /between 301 and 850/);

  const targets = clone(live);
  targets.targets.monthsWindow = 0;
  assert.ok(draftIssues(targets).targets);
  const eligibility = clone(live);
  eligibility.eligibility.maxProfitMultiplier = 25;
  assert.ok(draftIssues(eligibility).eligibility);
});

test('the change list says what moves from what to what', async () => {
  const live = configValues(await configService.getCreditConfig());
  const draft = clone(live);
  draft.weights.paymentHistory = 25;
  draft.weights.verification = 15;
  draft.bands.good = 640;
  draft.eligibility.maxProfitMultiplier = 2.5;
  assert.deepEqual(configChanges(live, draft), [
    { section: 'Weights', label: 'Payment history', from: '30%', to: '25%' },
    { section: 'Weights', label: 'Verification', from: '10%', to: '15%' },
    { section: 'Bands', label: 'Good from', from: '650', to: '640' },
    {
      section: 'Eligibility',
      label: 'Max loan',
      from: '3× yearly profit',
      to: '2.5× yearly profit',
    },
  ]);
  assert.deepEqual(configChanges(live, live), []);
});

test('the impact preview re-scores every farmer without changing anything live', async () => {
  const inputs = await configService.getScoringInputs();
  const farmers = await farmersService.list();
  assert.equal(inputs.length, farmers.filter((f) => !f.isGuest).length);
  const live = configValues(await configService.getCreditConfig());
  const before = JSON.stringify([...local.map.entries()]);

  const same = impactOf(inputs, live, live);
  assert.equal(same.changedScores, 0);
  assert.equal(same.averageCurrent, same.averageDraft);
  // The "live" side equals the scores everyone sees today.
  for (const f of same.farmers) {
    assert.equal(f.current, farmers.find((x) => x.userId === f.userId).stats.score);
  }

  const draft = clone(live);
  draft.weights = {
    paymentHistory: 20,
    recordCompleteness: 20,
    incomeStability: 20,
    momoActivity: 10,
    verification: 30,
  };
  draft.eligibility.minScore = 600;
  const impact = impactOf(inputs, live, draft);
  assert.ok(impact.changedScores > 0);
  const sum = (bands) => Object.values(bands).reduce((a, b) => a + b, 0);
  assert.equal(sum(impact.bandsCurrent), inputs.length);
  assert.equal(sum(impact.bandsDraft), inputs.length);
  assert.ok(impact.biggest.length <= 10);
  for (let i = 1; i < impact.biggest.length; i++) {
    assert.ok(Math.abs(impact.biggest[i - 1].delta) >= Math.abs(impact.biggest[i].delta));
  }
  for (const f of impact.gained) assert.ok(!f.eligibleNow && f.eligibleDraft);
  for (const f of impact.lost) assert.ok(f.eligibleNow && !f.eligibleDraft);
  const input = inputs[0];
  assert.equal(
    impact.farmers[0].eligibleDraft,
    meetsEligibility(input, impact.farmers[0].draft, draft),
  );

  assert.equal(JSON.stringify([...local.map.entries()]), before, 'previewing writes nothing');
  assert.equal((await configService.getCreditConfig()).version, 1, 'live rules untouched');
});

test('the simulator: custom numbers, factor points and the real formula agree', () => {
  const config = DEFAULT_CREDIT_CONFIG;
  const none = scoreFromFactors(
    factorsFromCounts(
      { activeMonths: 0, records: 0, momo: 0, income: 0, expenses: 0, verifiedChecks: 0 },
      config,
    ),
    config.weights,
  );
  assert.equal(none.score, 300);
  const best = scoreFromFactors(
    factorsFromCounts(
      { activeMonths: 6, records: 30, momo: 20, income: 1000, expenses: 400, verifiedChecks: 4 },
      config,
    ),
    config.weights,
  );
  assert.equal(best.score, 850);
  // Losses: expenses 1.5× income scores 0 for stability, like the real records do.
  const loss = factorsFromCounts(
    { activeMonths: 3, records: 10, momo: 5, income: 1000, expenses: 1500, verifiedChecks: 2 },
    config,
  );
  assert.equal(loss.incomeStability, 0);
  assert.equal(loss.paymentHistory, 50);

  // Points per factor add up (with the 300 base) to the score.
  const points = factorPoints(best, config.weights);
  const total = 300 + Object.values(points).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(total), 850);
});

test('publishing needs valid weights, a 10-character note and a real change; it is audited', async () => {
  const live = await configService.getCreditConfig();
  const draft = configValues(clone(live));
  draft.weights.paymentHistory = 25;
  await assert.rejects(
    () => configService.publishCreditConfig(draft, 'Weights are off by five.'),
    /add up to 100/,
  );
  draft.weights.verification = 15;
  await assert.rejects(
    () => configService.publishCreditConfig(draft, 'too short'),
    /10 characters/,
  );
  await assert.rejects(
    () => configService.publishCreditConfig(configValues(live), 'Nothing actually changed here.'),
    /Nothing changed/,
  );

  const inputs = await configService.getScoringInputs();
  const expected = impactOf(inputs, configValues(live), draft);
  const auditBefore = readAuditLog().length;
  const published = await configService.publishCreditConfig(
    draft,
    'Verification counts more; lenders asked for it.',
  );
  assert.equal(published.version, live.version + 1);
  assert.equal(published.note, 'Verification counts more; lenders asked for it.');
  assert.equal(published.updatedBy, 'Super Admin');

  const history = await configService.getCreditHistory();
  assert.equal(history[0].version, live.version, 'the previous version is kept');
  assert.deepEqual(configValues(history[0]), configValues(live));

  assert.equal(readAuditLog().length, auditBefore + 1);
  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'credit.publish');
  assert.equal(entry.before.version, live.version);
  assert.equal(entry.before.weights.paymentHistory, 30);
  assert.equal(entry.after.weights.paymentHistory, 25);
  assert.equal(entry.after.note, published.note);

  // Every farmer's score now follows the published rules (exactly what the preview said).
  const farmers = await farmersService.list();
  for (const f of expected.farmers) {
    assert.equal(farmers.find((x) => x.userId === f.userId).stats.score, f.draft);
  }
});

test('restoring copies an old version as a NEW version; history is never trimmed', async () => {
  const before = await configService.getCreditConfig();
  const historyBefore = await configService.getCreditHistory();
  const restored = await configService.restoreCreditVersion(1, 'Back to the original weights.');
  assert.equal(restored.version, before.version + 1);
  assert.equal(restored.restoredFrom, 1);
  assert.deepEqual(configValues(restored), configValues(DEFAULT_CREDIT_CONFIG));
  const history = await configService.getCreditHistory();
  assert.equal(history.length, historyBefore.length + 1, 'nothing removed');
  assert.ok(history.some((v) => v.version === 1) && history.some((v) => v.version === 2));
  assert.equal(readAuditLog().at(-1).action, 'credit.restore');
  await assert.rejects(() => configService.restoreCreditVersion(restored.version), /already live/);

  // Even a long history keeps every version (the old 50-version cap is gone).
  const long = Array.from({ length: 60 }, (_, i) => ({ ...restored, version: 1000 - i }));
  storage.set(PLATFORM_KEYS.creditHistory, long);
  const draft = configValues(clone(restored));
  draft.targets.recordsForFull = 35;
  await configService.publishCreditConfig(draft, 'Ask for a few more records.');
  assert.equal((await configService.getCreditHistory()).length, 61);
});

test('only a super admin can see or publish credit rules', async () => {
  const draft = configValues(await configService.getCreditConfig());
  draft.bands.good = 655;
  await adminAuthService.signOut();
  await adminAuthService.signIn('efua.asantewaa@agrictec.app', DEMO_PASSWORDS.team);
  await assert.rejects(() => configService.getScoringInputs(), /permission/i);
  await assert.rejects(() => configService.getCreditHistory(), /permission/i);
  await assert.rejects(
    () => configService.publishCreditConfig(draft, 'Trying without permission.'),
    /permission/i,
  );
  await assert.rejects(() => configService.restoreCreditVersion(1), /permission/i);
  // Farmers (and every admin) can still read the live rules their scores use.
  assert.ok((await configService.getCreditConfig()).version > 1);
});
