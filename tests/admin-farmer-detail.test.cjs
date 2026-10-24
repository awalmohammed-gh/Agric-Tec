/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-farmer-detail.test.cjs
// Phase A8: the farmer profile matches the farmer's own view, actions are audited, and
// "view as farmer" is strictly read-only.
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
// Enough of a document for sonner's style injection (loaded through the modal store).
const element = () => ({
  appendChild() {},
  insertBefore() {},
  setAttribute() {},
  firstChild: null,
});
globalThis.document = {
  cookie: '',
  head: element(),
  createElement: element,
  createTextNode: () => ({}),
  getElementsByTagName: () => [element()],
};
const local = globalThis.window.localStorage;

const { readAuditLog } = require('../lib/admin/audit.ts');
const {
  claimImpersonation,
  endImpersonation,
  impersonatedSession,
  startImpersonation,
} = require('../lib/admin/impersonation.ts');
const { overviewKpis } = require('../lib/admin/overview.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { calculateCreditScore } = require('../lib/calculations/credit-score.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { teamService } = require('../services/admin/team.service.ts');
const { authService } = require('../services/auth.service.ts');
const { READ_ONLY_MESSAGE, storage } = require('../services/storage.ts');
const { loadAllStores, resetAllStores } = require('../store/index.ts');
const { useAuthStore } = require('../store/auth-store.ts');
const { useChatStore } = require('../store/chat-store.ts');
const { useFarmStore } = require('../store/farm-store.ts');
const { useLoanStore } = require('../store/loan-store.ts');
const { useModalStore } = require('../store/modal-store.ts');
const { usePlatformStore } = require('../store/platform-store.ts');
const { useProfileStore } = require('../store/profile-store.ts');
const { useSettingsStore } = require('../store/settings-store.ts');

const STRONG = 'Harvest#2026!';
let farmers;

test('setup: sign in as super admin', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
  farmers = await farmersService.list();
});

test('the profile page shows exactly what the farmer sees when they log in', async () => {
  const farmer = farmers.find((f) => f.status === 'active' && f.stats.records > 5);
  const detail = await farmersService.getDetail(farmer.userId);
  const apps = await loanApplicationsService.list({ userId: farmer.userId });

  // The farmer logs in to the farmer app.
  const session = await authService.signIn(farmer.email, DEMO_PASSWORDS.farmer);
  useAuthStore.setState({ session, status: 'ready' });
  await loadAllStores(session.userId);

  const ids = (list) => list.map((x) => x.id).sort();
  assert.deepEqual(ids(useFarmStore.getState().records), ids(detail.records));
  assert.deepEqual(ids(useFarmStore.getState().momo), ids(detail.momo));
  assert.deepEqual(useProfileStore.getState().profile, detail.account.profile);
  assert.deepEqual(ids(useLoanStore.getState().applications), ids(apps));
  const farmerScore = calculateCreditScore(
    useFarmStore.getState().records,
    useFarmStore.getState().momo,
    useProfileStore.getState().profile,
    usePlatformStore.getState().creditConfig,
  ).score;
  assert.equal(farmerScore, detail.credit.score);

  // Admin notes are never part of anything the farmer app loads.
  const farmerSide = JSON.stringify([
    useFarmStore.getState(),
    useProfileStore.getState(),
    useSettingsStore.getState(),
    useChatStore.getState(),
    usePlatformStore.getState(),
    useLoanStore.getState(),
  ]);
  await farmersService.addNote(farmer.userId, 'PRIVATE-NOTE-123 do not show the farmer');
  await loadAllStores(session.userId);
  assert.ok(!farmerSide.includes('PRIVATE-NOTE-123'));
  assert.ok(
    !JSON.stringify([useProfileStore.getState(), useFarmStore.getState()]).includes('PRIVATE-NOTE'),
  );
  await authService.signOut();
  resetAllStores();
});

test('only the farmer edits their profile: the console has no way to change it', () => {
  // The farmer knows their own details; the console can read them, never write them.
  assert.equal('updateProfile' in farmersService, false);
});

test('view as farmer: audited, single-use, and strictly read-only', async () => {
  const farmer = farmers.find((f) => f.status === 'active' && f.stats.records > 0);
  const url = await startImpersonation(farmer.userId);
  assert.match(url, /^\/dashboard\?impersonate=/);
  assert.equal(readAuditLog().at(-1).action, 'farmer.impersonate');
  const token = decodeURIComponent(url.split('impersonate=')[1]);

  // The farmer tab claims it once.
  const view = claimImpersonation(token);
  assert.equal(view.farmerId, farmer.userId);
  assert.equal(claimImpersonation(token), null, 'tokens are single use');
  assert.match(document.cookie, /agrictec_impersonating=1/);

  // DataLoader's read-only setup.
  storage.setReadOnly(true);
  useAuthStore.setState({
    session: impersonatedSession(view),
    status: 'ready',
    impersonation: view,
  });
  await loadAllStores(view.farmerId);
  assert.equal(useFarmStore.getState().records.length, farmer.stats.records, 'sees their data');
  const snapshot = [...local.map.entries()];

  const refused = { message: READ_ONLY_MESSAGE };
  await assert.rejects(
    () =>
      useFarmStore.getState().addRecord({
        type: 'income',
        description: 'Sneaky',
        crop: 'Maize',
        amount: 1,
        date: '2026-01-01',
      }),
    refused,
  );
  await assert.rejects(
    () => useFarmStore.getState().deleteRecord(useFarmStore.getState().records[0].id),
    refused,
  );
  await assert.rejects(() => useFarmStore.getState().loadSampleData(), refused);
  await assert.rejects(() => useProfileStore.getState().save({ name: 'Changed' }), refused);
  await assert.rejects(() => useSettingsStore.getState().setLanguage('tw'), refused);
  await assert.rejects(() => useChatStore.getState().sendMessage('hello'), refused);
  await assert.rejects(
    () => usePlatformStore.getState().submitGhanaCard('GHA-123456789-0'),
    refused,
  );
  assert.throws(
    () =>
      useLoanStore
        .getState()
        .openConfirm({ amount: 1000, purpose: 'x', months: 6, partnerId: 'sinapi' }),
    refused,
  );
  useModalStore.getState().openModal('record');
  assert.equal(useModalStore.getState().modal, null, 'record form does not open');
  // Even a direct write is refused at the storage layer.
  assert.throws(() => storage.set('users', []), refused);
  assert.deepEqual([...local.map.entries()], snapshot, 'nothing in storage changed');

  // An analyst (no farmers.impersonate) can't claim a token.
  endImpersonation();
  assert.equal(storage.isReadOnly(), false);
  assert.equal(readAuditLog().at(-1).action, 'farmer.impersonate_end');
  useAuthStore.setState({ session: null, impersonation: null });
  resetAllStores();
  const next = await startImpersonation(farmer.userId);
  await adminAuthService.signOut();
  await adminAuthService.signIn('yaw.darko@agrictec.app', DEMO_PASSWORDS.team);
  assert.equal(claimImpersonation(decodeURIComponent(next.split('impersonate=')[1])), null);
  await assert.rejects(() => startImpersonation(farmer.userId), /permission/);
  await adminAuthService.signOut();
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG);
});

test('a reset password works for the farmer’s next login', async () => {
  const farmer = farmers.find((f) => f.status === 'active' && f.userId !== farmers[0].userId);
  const temporary = await farmersService.resetPassword(farmer.userId);
  await assert.rejects(() => authService.signIn(farmer.email, DEMO_PASSWORDS.farmer), /Incorrect/);
  const session = await authService.signIn(farmer.email, temporary);
  assert.equal(session.userId, farmer.userId);
  await authService.signOut();
});

test('deleting a farmer erases their data, list entry and KPIs; the audit keeps counts only', async () => {
  const farmer = farmers.find((f) => f.stats.records > 0 && f.status === 'active');
  await assert.rejects(() => farmersService.remove(farmer.userId, 'wrong@email'), /email or name/);
  await farmersService.remove(farmer.userId, farmer.email);

  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'farmer.delete');
  assert.deepEqual(Object.keys(entry.before).sort(), [
    'applications',
    'diagnoses',
    'momo',
    'records',
  ]);
  assert.ok(!JSON.stringify(entry).includes(farmer.email), 'no contact details in the audit');

  assert.ok(![...local.map.keys()].some((k) => k.startsWith(`agrictec:${farmer.userId}:`)));
  const after = await farmersService.list();
  assert.ok(!after.some((f) => f.userId === farmer.userId));
  assert.equal(overviewKpis(after, [], [], [], 'all').totalFarmers, 59);
  await assert.rejects(() => farmersService.getDetail(farmer.userId), /Farmer not found/);
  await assert.rejects(() => authService.signIn(farmer.email, DEMO_PASSWORDS.farmer), /Incorrect/);
});

test('only a super admin can delete', async () => {
  const efua = (await teamService.list()).find((a) => a.role === 'admin');
  await adminAuthService.signOut();
  await adminAuthService.signIn(efua.email, DEMO_PASSWORDS.team);
  const target = (await farmersService.list())[0];
  await assert.rejects(() => farmersService.remove(target.userId, target.email), /permission/);
  // …and the credit config is untouched by all of this.
  assert.equal((await configService.getCreditConfig()).version, 1);
});
