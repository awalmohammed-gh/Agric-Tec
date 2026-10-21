/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-farmer-config.test.cjs
// Phase A3: the farmer app obeys the admin's settings, and is unchanged with the defaults.
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

const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { isSameMonth, startOfMonth, subMonths } = require('date-fns');
const { parseISODate } = require('../lib/format.ts');
const { profitMargin, totalExpenses, totalIncome } = require('../lib/calculations/finance.ts');
const { calculateCreditScore, isProfileComplete } = require('../lib/calculations/credit-score.ts');
const { checkEligibility } = require('../lib/calculations/loan.ts');
const { getAssistantReply } = require('../lib/ai/assistant-replies.ts');
const { DEFAULT_CREDIT_CONFIG, DEFAULT_FLAGS } = require('../lib/admin/defaults.ts');
const { buildSeedWorld, DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { enabledNavSections, mobileNavFor } = require('../constants/navigation.ts');
const { FeatureGate, FeatureUnavailable } = require('../components/shared/feature-gate.tsx');
const { gateView } = require('../components/shared/maintenance-gate.tsx');
const { MaintenanceScreen } = require('../components/shared/maintenance-screen.tsx');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { contentService } = require('../services/admin/content.service.ts');
const { lendersService } = require('../services/admin/lenders.service.ts');
const { announcementsService } = require('../services/admin/announcements.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { authService, SUSPENDED_MESSAGE } = require('../services/auth.service.ts');
const { loansService } = require('../services/loans.service.ts');
const { marketService } = require('../services/market.service.ts');
const { useAuthStore } = require('../store/auth-store.ts');
const { usePlatformStore, initialPlatformState } = require('../store/platform-store.ts');

/** The credit score exactly as phases 1–15 wrote it, with its fixed weights. */
function originalScore(records, momo, profile) {
  const dates = [...records, ...momo].map((item) => parseISODate(item.date));
  const thisMonth = startOfMonth(new Date());
  let active = 0;
  for (let i = 0; i < 6; i++) {
    if (dates.some((date) => isSameMonth(date, subMonths(thisMonth, i)))) active++;
  }
  const paymentHistory = (active / 6) * 100;
  const recordCompleteness = Math.min(100, ((records.length + momo.length) / 30) * 100);
  const income = totalIncome(records);
  const expenses = totalExpenses(records);
  const incomeStability =
    income <= 0
      ? 0
      : income >= expenses
        ? Math.min(100, 50 + profitMargin(records))
        : Math.max(0, 50 - (expenses / income - 1) * 100);
  const momoActivity = Math.min(100, (momo.length / 20) * 100);
  const checks = [
    isProfileComplete(profile),
    profile?.verification.phone ?? false,
    profile?.verification.location ?? false,
    profile?.verification.ghanaCard ?? false,
  ];
  const verification = (checks.filter(Boolean).length / checks.length) * 100;
  const weighted =
    paymentHistory * 0.3 +
    recordCompleteness * 0.25 +
    incomeStability * 0.25 +
    momoActivity * 0.1 +
    verification * 0.1;
  return Math.round(300 + (Math.min(100, Math.max(0, weighted)) / 100) * 550);
}

const ADMIN_PASSWORD = 'Harvest#2026';

async function asAdmin() {
  if ((await adminAuthService.getSession())?.admin.role === 'super_admin') return;
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin).catch(() => null);
  const session = await adminAuthService.getSession();
  if (!session) await adminAuthService.signIn(SUPER_ADMIN_EMAIL, ADMIN_PASSWORD);
  else if (session.admin.mustChangePassword) {
    await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, ADMIN_PASSWORD);
  }
}

test('with the default config, every credit score is identical to before', async () => {
  const world = await buildSeedWorld();
  assert.ok(world.farmers.length >= 55);
  for (const { data } of world.farmers) {
    const before = originalScore(data.records, data.momo, data.profile);
    assert.equal(calculateCreditScore(data.records, data.momo, data.profile).score, before);
    assert.equal(
      calculateCreditScore(data.records, data.momo, data.profile, DEFAULT_CREDIT_CONFIG).score,
      before,
    );
  }
  // And the default eligibility rules are the original 5 records / 550 / 3×.
  const result = checkEligibility({ amount: 1_000_000, records: [], score: 549 });
  assert.deepEqual(
    result.issues.map((i) => i.code),
    ['records', 'affordability', 'score'],
  );
  assert.match(result.reasons[1], /3× your yearly profit/);
});

test('admin credit rules change the farmer’s score and eligibility', async () => {
  const { data } = (await buildSeedWorld()).farmers.find((f) => f.data.records.length > 10);
  const base = calculateCreditScore(data.records, data.momo, data.profile).score;
  const allVerification = {
    ...DEFAULT_CREDIT_CONFIG,
    weights: {
      paymentHistory: 0,
      recordCompleteness: 0,
      incomeStability: 0,
      momoActivity: 0,
      verification: 100,
    },
  };
  const changed = calculateCreditScore(data.records, data.momo, data.profile, allVerification);
  assert.notEqual(changed.score, base);
  const stricter = checkEligibility({
    amount: 0,
    records: data.records.slice(0, 5),
    score: 700,
    rules: { minRecords: 10, minScore: 600, maxProfitMultiplier: 1 },
  });
  assert.match(stricter.reasons[0], /at least 10 farm records/);
});

test('aiAssistant off: the nav item disappears and /assistant shows the unavailable message', () => {
  const flags = { ...DEFAULT_FLAGS, aiAssistant: false };
  const labels = enabledNavSections(flags).flatMap((s) => s.items.map((i) => i.label));
  assert.ok(!labels.includes('AI Assistant'));
  assert.ok(labels.includes('AI Crop Doctor'));
  // Switching off a bottom-bar page backfills the bar, so it keeps four destinations.
  const mobile = mobileNavFor({ ...DEFAULT_FLAGS, cropDoctor: false });
  assert.equal(mobile.primary.length, 4);
  assert.ok(!mobile.primary.some((i) => i.href === '/crop-doctor'));
  assert.ok(!mobile.menu.some((i) => i.href === '/crop-doctor'));

  // Server rendering reads a zustand store's initial state (all features on), so the gate
  // renders the page; the unavailable card it swaps in is rendered on its own.
  assert.equal(
    renderToStaticMarkup(createElement(FeatureGate, { flag: 'aiAssistant' }, 'CHAT')),
    'CHAT',
  );
  assert.match(
    renderToStaticMarkup(createElement(FeatureUnavailable)),
    /This feature is currently unavailable/,
  );
  usePlatformStore.setState({ flags });
  assert.equal(usePlatformStore.getState().flags.aiAssistant, false);
  usePlatformStore.setState(initialPlatformState());
});

test('maintenance mode shows the maintenance screen to farmers, and turns off again', async () => {
  await asAdmin();
  const flags = await configService.getFlags();
  await configService.saveFlags({
    ...flags,
    maintenanceMode: true,
    maintenanceMessage: 'Back at 6pm.',
  });
  const loaded = await usePlatformStore.getState().loadFlags();
  assert.equal(
    gateView(usePlatformStore.getState().flagsStatus, loaded.maintenanceMode),
    'maintenance',
  );
  const page = renderToStaticMarkup(
    createElement(MaintenanceScreen, { message: loaded.maintenanceMessage }),
  );
  assert.match(page, /right back/);
  assert.match(page, /Back at 6pm\./);
  assert.match(page, /Please check back soon/);

  await configService.saveFlags({ ...flags, maintenanceMode: false });
  const reopened = await usePlatformStore.getState().loadFlags();
  assert.equal(gateView('ready', reopened.maintenanceMode), 'page');
  assert.equal(gateView('loading', false), 'loading');
  // The admin console is unaffected: admins still act during maintenance.
  assert.equal((await adminAuthService.getSession()).admin.role, 'super_admin');
});

test('signup and guest mode are blocked in the service when their flags are off', async () => {
  const flags = await configService.getFlags();
  await configService.saveFlags({ ...flags, signupOpen: false, guestMode: false });
  await assert.rejects(() => authService.signUp('new@farm.gh', 'Password1'), /sign-ups are closed/);
  await assert.rejects(() => authService.continueAsGuest(), /Guest mode is turned off/);
  await configService.saveFlags({ ...flags, signupOpen: true, guestMode: true });
  const session = await authService.signUp('new@farm.gh', 'Password1');
  assert.equal(session.role, 'farmer');
});

test('a suspended farmer cannot sign in, and an open session is ended on the next load', async () => {
  await asAdmin();
  const farmer = (await farmersService.list()).find((f) => f.status === 'active' && !f.isGuest);
  const session = await authService.signIn(farmer.email, DEMO_PASSWORDS.farmer);
  assert.equal(await authService.checkAccount(session.userId), 'active');

  await farmersService.suspend(farmer.userId, 'Fake receipts');
  await assert.rejects(() => authService.signIn(farmer.email, DEMO_PASSWORDS.farmer), {
    message: SUSPENDED_MESSAGE,
  });
  // DataLoader calls checkAccount on load and signs a suspended farmer out.
  assert.equal(await authService.checkAccount(session.userId), 'suspended');
  await farmersService.reactivate(farmer.userId);
  await authService.signIn(farmer.email, DEMO_PASSWORDS.farmer);
});

test('a Ghana Card goes to review: the profile waits and the admin queue has it', async () => {
  await asAdmin();
  const farmer = (await farmersService.list()).find(
    (f) => f.status === 'active' && !f.profile.verification.ghanaCard && !f.isGuest,
  );
  const session = await authService.signIn(farmer.email, DEMO_PASSWORDS.farmer);
  useAuthStore.setState({ session });
  await usePlatformStore.getState().load(session.userId);
  const pendingBefore = (await verificationsService.list({ status: 'pending' })).length;

  const request = await usePlatformStore.getState().submitGhanaCard('GHA-123456789-0');
  assert.equal(request.status, 'pending');
  assert.equal(request.submittedValue, 'GHA-******789-0', 'only a masked number is stored');
  assert.ok(!JSON.stringify(local.map).includes('123456789'), 'full number never stored');
  assert.equal(usePlatformStore.getState().verifications[0].status, 'pending');
  assert.equal((await farmersService.get(farmer.userId)).profile.verification.ghanaCard, false);
  const queue = await verificationsService.list({ status: 'pending' });
  assert.equal(queue.length, pendingBefore + 1);
  assert.ok(queue.some((v) => v.id === request.id));

  // Phone stays instant, but also logs an approved request.
  await usePlatformStore.getState().logInstantCheck('phone', farmer.profile.phone);
  const logged = await verificationsService.list({ userId: farmer.userId, kind: 'phone' });
  assert.equal(logged[0].status, 'approved');

  await verificationsService.approve(request.id);
  assert.equal((await farmersService.get(farmer.userId)).profile.verification.ghanaCard, true);
});

test('lenders, content, announcements and plans flow from the admin into the farmer app', async () => {
  await asAdmin();
  // Lenders: a switched-off lender disappears from the farmer's offers.
  const [first] = await lendersService.list();
  await lendersService.toggleActive(first.id);
  assert.ok(!(await loansService.getPartners()).some((l) => l.id === first.id));
  await lendersService.toggleActive(first.id);

  // Weather: the admin's override replaces the simulated weather.
  const override = {
    condition: 'storm',
    temp: 21,
    description: 'Admin storm',
    humidity: 90,
    rainChance: 95,
  };
  await contentService.saveWeatherOverride(override);
  assert.equal((await marketService.getWeather()).description, 'Admin storm');
  await contentService.saveWeatherOverride(null);
  assert.notEqual((await marketService.getWeather()).description, 'Admin storm');

  // Prices: the admin's prices are what the farmer sees.
  const prices = await contentService.getMarketPrices();
  await contentService.saveMarketPrices(
    prices.map((p) => (p.crop === 'Cocoa' ? { ...p, price: 2000 } : p)),
  );
  assert.equal((await marketService.getPrices()).find((p) => p.crop === 'Cocoa').price, 2000);

  // Assistant: a new knowledge item wins by priority; placeholders use the farmer's data.
  const kb = await contentService.getAssistantKb();
  await contentService.saveAssistantKb([
    {
      id: 'kb-irrigation',
      keywords: ['irrigat*'],
      priority: 500,
      active: true,
      reply: { title: 'Irrigation for {name}', intro: 'Score {score}, income {income}.' },
    },
    ...kb,
  ]);
  const ctx = {
    farmerName: 'Ama',
    region: 'Ashanti',
    primaryCrops: [],
    score: 640,
    income: 1200,
    expenses: 0,
    recordCount: 3,
  };
  const reply = await getAssistantReply('drip irrigation tips', ctx, {
    knowledge: await contentService.getAssistantKb(),
  });
  assert.equal(reply.title, 'Irrigation for Ama');
  assert.equal(reply.intro, 'Score 640, income GHS 1,200.');
  // A switched-off item is skipped.
  const withoutGreeting = (await contentService.getAssistantKb()).map((item) =>
    item.id === 'kb-greeting' ? { ...item, active: false } : item,
  );
  assert.equal(
    (await getAssistantReply('hello', ctx, { knowledge: withoutGreeting })).title,
    'Let me help',
  );

  // Announcements: audience and per-farmer dismissal.
  const live = await announcementsService.activeFor({
    region: 'Northern',
    primaryCrops: ['Maize'],
  });
  assert.ok(live.length >= 2);
  const session = useAuthStore.getState().session;
  await usePlatformStore.getState().load(session.userId);
  await usePlatformStore.getState().dismissAnnouncement(live[0].id);
  await usePlatformStore.getState().load(session.userId);
  assert.ok(usePlatformStore.getState().dismissed.includes(live[0].id));

  // Plans: the farmer app reads the admin's price.
  const plans = await configService.getPlans();
  await configService.savePlans(
    plans.map((p) => (p.id === 'premium' ? { ...p, priceGHS: 30 } : p)),
  );
  await usePlatformStore.getState().load(session.userId);
  assert.equal(usePlatformStore.getState().plans.find((p) => p.id === 'premium').priceGHS, 30);
});

test('applications: farmers see the admin’s status; old per-farmer applications are adopted once', async () => {
  const session = useAuthStore.getState().session;
  const legacy = {
    id: 'legacy-app-1',
    userId: session.userId,
    reference: 'APP-2025-11111',
    partnerId: 'sinapi',
    amount: 5000,
    months: 12,
    purpose: 'Seeds & Fertilizer',
    monthly: 460,
    status: 'submitted',
    createdAt: '2025-12-01T10:00:00.000Z',
  };
  local.setItem(`agrictec:${session.userId}:loanApplications`, JSON.stringify([legacy]));
  const mine = await loansService.listApplications(session.userId);
  const adopted = mine.find((a) => a.id === 'legacy-app-1');
  assert.equal(adopted.status, 'submitted');
  assert.equal(adopted.history.length, 1);
  assert.equal(local.getItem(`agrictec:${session.userId}:loanApplications`), null);
  assert.equal(
    (await loansService.listApplications(session.userId)).filter((a) => a.id === 'legacy-app-1')
      .length,
    1,
  );

  await asAdmin();
  await loanApplicationsService.updateStatus('legacy-app-1', 'under_review', 'Checking records');
  const [updated] = (await loansService.listApplications(session.userId)).filter(
    (a) => a.id === 'legacy-app-1',
  );
  assert.equal(updated.status, 'under_review');
  assert.equal(updated.history.at(-1).note, 'Checking records');

  // New applications record the score at the time of applying, with the lender's rate.
  const app = await loansService.submitApplication(
    session.userId,
    { partnerId: 'sinapi', amount: 3000, purpose: 'Farm Equipment', months: 12, monthly: 275 },
    612,
  );
  assert.equal(app.scoreAtApplication, 612);
  assert.equal(app.rate, 18);
  assert.ok(
    JSON.parse(local.getItem(`agrictec:${PLATFORM_KEYS.loanApplications}`)).some(
      (a) => a.id === app.id,
    ),
  );
});
