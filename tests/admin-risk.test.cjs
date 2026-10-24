/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-risk.test.cjs
// Phase A13: the seven risk rules (thresholds at their edges), de-duplicated scans, the audited
// review flow (dismiss, confirm, confirm + suspend) and confirmed flags visible across the app.
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

const { readAuditLog } = require('../lib/admin/audit.ts');
const { DEFAULT_CREDIT_CONFIG } = require('../lib/admin/defaults.ts');
const { FARMER_DATA, PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const {
  RISK_RULES,
  confirmedRiskUsers,
  detectRisks,
  riskKey,
  summarizeRisk,
} = require('../lib/admin/risk-rules.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { defaultProfile } = require('../lib/profile.ts');
const { buildReportData } = require('../lib/reports/build-report-data.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { riskService } = require('../services/admin/risk.service.ts');
const { storage, userKey } = require('../services/storage.ts');

const STRONG = 'Harvest#2026!';
const ALL_RULES = RISK_RULES.map((r) => r.id);
const iso = (date, time = '10:00:00') => `${date}T${time}.000Z`;

// ---------- Rule units, with hand-made farmers ----------

let n = 0;
function subject(userId, { profile = {}, records = [], momo = [] } = {}) {
  return {
    userId,
    profile: { ...defaultProfile(userId), name: userId, ...profile },
    records: records.map((r) => ({
      id: `${userId}-r${++n}`,
      userId,
      type: 'expense',
      description: 'Inputs',
      crop: 'Maize',
      amount: 1000,
      date: '2026-06-01',
      createdAt: iso('2026-06-01'),
      ...r,
    })),
    momo: momo.map((t) => ({
      id: `${userId}-m${++n}`,
      userId,
      direction: 'in',
      counterparty: 'Buyer',
      amount: 1200,
      reference: `REF${n}`,
      date: '2026-06-01',
      createdAt: iso('2026-06-01'),
      ...t,
    })),
  };
}
const ruleHits = (subjects, rule) => detectRisks(subjects).filter((f) => f.rule === rule);

test('duplicate MoMo reference: in one account and across accounts, with amounts', () => {
  const one = subject('a', {
    momo: [{ reference: 'MOMO483920' }, { reference: 'momo483920 ' }, { reference: 'OTHER1' }],
  });
  const [flag] = ruleHits([one], 'duplicate_momo_ref');
  assert.equal(
    flag.description,
    'Reference MOMO483920 appears on 2 transactions (GHS 1,200 and GHS 1,200).',
  );
  assert.equal(flag.severity, 'high');
  assert.equal(flag.relatedIds.length, 2);

  const b = subject('b', { momo: [{ reference: 'SHARED9', amount: 500 }] });
  const c = subject('c', { momo: [{ reference: 'SHARED9', amount: 700 }] });
  const across = ruleHits([b, c], 'duplicate_momo_ref');
  assert.deepEqual(
    across.map((f) => f.userId),
    ['b', 'c'],
  );
  assert.match(across[0].description, /across 2 accounts \(GHS 500 and GHS 700\)/);
});

test('unusual amount: more than 5× the median and above GHS 5,000', () => {
  const base = Array.from({ length: 5 }, () => ({ amount: 1000 }));
  const hit = subject('a', { records: [...base, { amount: 5500, date: '2026-06-02' }] });
  assert.equal(ruleHits([hit], 'amount_outlier').length, 1);
  // 5× exactly, or not above GHS 5,000: no flag.
  const fiveTimes = subject('b', { records: [...base, { amount: 5000 }] });
  assert.equal(ruleHits([fiveTimes], 'amount_outlier').length, 0);
  const small = subject('c', {
    records: [...Array.from({ length: 5 }, () => ({ amount: 100 })), { amount: 4000 }],
  });
  assert.equal(ruleHits([small], 'amount_outlier').length, 0);
});

test('burst of entries: more than 10 records created on the same day', () => {
  const day = (count) =>
    Array.from({ length: count }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      createdAt: iso('2026-06-10', `09:${String(i).padStart(2, '0')}:00`),
    }));
  assert.equal(ruleHits([subject('a', { records: day(11) })], 'burst_entries').length, 1);
  assert.equal(ruleHits([subject('b', { records: day(10) })], 'burst_entries').length, 0);
});

test('income spike: more than 300% above the previous 3 months and above GHS 10,000', () => {
  const months = (latest) => [
    { type: 'income', amount: 3000, date: '2026-03-10' },
    { type: 'income', amount: 3000, date: '2026-04-10' },
    { type: 'income', amount: 3000, date: '2026-05-10' },
    { type: 'income', amount: latest, date: '2026-06-10' },
  ];
  const [hit] = ruleHits([subject('a', { records: months(13000) })], 'income_spike');
  assert.match(hit.description, /June 2026 was GHS 13,000, 333% above/);
  // Exactly 4× (300% above) is not more than 300%.
  assert.equal(ruleHits([subject('b', { records: months(12000) })], 'income_spike').length, 0);
});

test('backdated bulk: more than 15 records dated over 90 days before entry', () => {
  const late = (count) =>
    Array.from({ length: count }, (_, i) => ({
      date: '2026-01-01',
      createdAt: iso(`2026-04-${String(10 + (i % 2)).padStart(2, '0')}`),
    }));
  const [hit] = ruleHits([subject('a', { records: late(16) })], 'backdated_bulk');
  assert.equal(hit.severity, 'low');
  assert.match(hit.description, /^16 records were entered more than 90 days/);
  assert.equal(ruleHits([subject('b', { records: late(15) })], 'backdated_bulk').length, 0);
});

test('shared phone and shared Ghana Card hash flag every account in the group', () => {
  const card = { status: 'pending', masked: 'GHA-******821-4', hash: 'a'.repeat(64) };
  const subjects = [
    subject('a', { profile: { phone: '0244123456', ghanaCard: card } }),
    subject('b', { profile: { phone: '+233244123456', ghanaCard: card } }),
    subject('c', { profile: { phone: '0200000000' } }),
  ];
  const phones = ruleHits(subjects, 'shared_phone');
  assert.deepEqual(
    phones.map((f) => [f.userId, f.relatedIds]),
    [
      ['a', ['b']],
      ['b', ['a']],
    ],
  );
  const cards = ruleHits(subjects, 'shared_ghana_card');
  assert.equal(cards.length, 2);
  assert.equal(cards[0].severity, 'high');
  assert.match(cards[0].description, /GHA-\*{6}821-4.*the account of b/);
});

// ---------- The service: scans, review and visibility ----------

let flagged; // a farmer whose fraud gets confirmed

test('setup: sign in as super admin (the first sign-in seeds the demo data)', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
});

test('a scan finds every planted case; running it again adds no duplicates', async () => {
  storage.set(PLATFORM_KEYS.riskFlags, []);
  const found = await riskService.runScan();
  for (const rule of ALL_RULES)
    assert.ok(
      found.some((f) => f.rule === rule),
      `found ${rule}`,
    );
  assert.equal(new Set(found.map(riskKey)).size, found.length, 'no duplicate findings');
  assert.equal((await riskService.runScan()).length, 0, 'second scan adds nothing');
  assert.equal(readAuditLog().filter((e) => e.action === 'risk.scan').length, 2);
});

test('a MoMo transaction reusing a reference on the farmer side is flagged on rescan', async () => {
  const farmers = (await farmersService.list()).filter((f) => !f.isGuest);
  const [owner, other] = farmers.filter((f) => f.stats.momo > 0);
  const existing = storage.get(userKey(owner.userId, FARMER_DATA.momo), [])[0];
  const momo = storage.get(userKey(other.userId, FARMER_DATA.momo), []);
  storage.set(userKey(other.userId, FARMER_DATA.momo), [
    {
      ...momo[0],
      id: `${other.userId}-momo-copy`,
      reference: existing.reference,
      amount: existing.amount,
    },
    ...momo,
  ]);
  const found = await riskService.runScan();
  const dup = found.filter((f) => f.rule === 'duplicate_momo_ref');
  assert.deepEqual(dup.map((f) => f.userId).sort(), [owner.userId, other.userId].sort());
  assert.match(dup[0].description, new RegExp(`${existing.reference} .*across 2 accounts`));

  // The review screen shows both transactions, each with its owner.
  const related = await riskService.getRelated(dup[0].id);
  assert.equal(related.kind, 'momo');
  assert.equal(related.momo.filter((t) => t.related).length, 2);
});

test('dismiss needs a note, moves the flag to Dismissed and is audited', async () => {
  const [open] = await riskService.list({ status: 'open', rule: 'burst_entries' });
  await assert.rejects(() => riskService.dismiss(open.id, ''), /Add a short note/);
  const dismissed = await riskService.dismiss(open.id, 'Legitimate cooperative bulk entry');
  assert.equal(dismissed.status, 'dismissed');
  assert.equal(dismissed.note, 'Legitimate cooperative bulk entry');
  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'risk.dismiss');
  assert.deepEqual(entry.after, { status: 'dismissed', note: 'Legitimate cooperative bulk entry' });
  // Dismissed stays dismissed: a rescan never brings it back.
  assert.equal((await riskService.runScan()).length, 0);
  await assert.rejects(
    () => riskService.confirm(open.id, 'Changed my mind'),
    /already been reviewed/,
  );
});

test('support can confirm but not suspend: nothing changes when suspend is asked', async () => {
  await adminAuthService.signOut();
  await adminAuthService.signIn('kofi.adjei@agrictec.app', DEMO_PASSWORDS.team);
  const [open] = await riskService.list({ status: 'open', rule: 'shared_phone' });
  await assert.rejects(
    () => riskService.confirm(open.id, 'Same person, two accounts', { suspend: true }),
    /permission|not allowed|don.t have/i,
  );
  assert.equal((await riskService.list()).find((f) => f.id === open.id).status, 'open');
  await adminAuthService.signOut();
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG);
});

test('confirm with "Suspend farmer now" suspends the farmer and shows the Risk tag', async () => {
  const [open] = await riskService.list({ status: 'open', rule: 'shared_phone' });
  flagged = open.userId;
  const before = readAuditLog().length;
  const confirmed = await riskService.confirm(open.id, 'Same person runs both accounts', {
    suspend: true,
  });
  assert.equal(confirmed.status, 'confirmed');
  const actions = readAuditLog()
    .slice(before)
    .map((e) => e.action);
  assert.deepEqual(actions, ['risk.confirm', 'farmer.suspend']);

  const account = await farmersService.get(flagged);
  assert.equal(account.status, 'suspended');
  assert.match(account.suspendedReason, /Confirmed fraud \(Shared phone number\)/);
  assert.equal(account.riskConfirmed, 1, 'the Risk tag');
  assert.ok(confirmedRiskUsers(await riskService.list()).has(flagged));

  const summary = summarizeRisk(await riskService.list());
  assert.ok(summary.byStatus.confirmed >= 1 && summary.byStatus.dismissed >= 1);
  assert.ok(summary.mostFlagged.count >= 1);
});

test('the farmer’s lender-facing Loan Readiness report says "Account under review"', async () => {
  assert.equal(await riskService.underReview(flagged), true);
  const stats = {
    credit: {
      score: 700,
      paymentHistory: 80,
      recordCompleteness: 80,
      incomeStability: 80,
      momoActivity: 80,
      verification: 80,
    },
    creditLabel: 'Good',
    creditConfig: DEFAULT_CREDIT_CONFIG,
    loanRules: DEFAULT_CREDIT_CONFIG.eligibility,
    borrowingPower: 30000,
    profit: 10000,
    margin: 40,
    annualizedProfit: 10000,
  };
  const source = { records: [], momo: [], profile: null, stats };
  const reviewed = buildReportData('loan', { ...source, underReview: true });
  assert.equal(reviewed.summary[0].value, 'Account under review');
  assert.match(reviewed.sections[0].body, /^Account under review\./);
  assert.ok(reviewed.summary.some((s) => /Withheld/.test(s.value)));
  const normal = buildReportData('loan', source);
  assert.ok(!normal.summary.some((s) => s.value === 'Account under review'));
});
