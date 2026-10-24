/* eslint-disable @typescript-eslint/no-require-imports -- Load the app's TypeScript with the existing test convention. */
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

const values = new Map();
const localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const { subscriptionService, nextBillingDate } = require('../services/subscription.service.ts');
const { normalizePlans, planAccess, PLAN_CATALOG } = require('../lib/subscriptions/plans.ts');
const { plansSchema } = require('../lib/admin/schemas.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { DEFAULT_FLAGS } = require('../lib/admin/defaults.ts');
const { storage } = require('../services/storage.ts');
const { useSubscriptionStore } = require('../store/subscription-store.ts');
const { useAuthStore } = require('../store/auth-store.ts');
global.window = { localStorage, sessionStorage: localStorage };
const now = new Date('2026-10-15T12:00:00Z');

test('four monthly tiers use the agreed prices and older catalogues keep custom settings', () => {
  assert.deepEqual(
    PLAN_CATALOG.map((p) => [p.id, p.priceGHS]),
    [
      ['free', 0],
      ['basic', 25],
      ['premium', 50],
      ['advanced', 100],
    ],
  );
  const legacy = normalizePlans([
    { id: 'free', name: 'Free Plan', priceGHS: 0, active: true, features: ['AI assistant'] },
    {
      id: 'premium',
      name: 'Custom premium',
      priceGHS: 35,
      active: false,
      features: ['Custom benefit'],
    },
  ]);
  assert.equal(legacy.length, 4);
  assert.equal(legacy[2].priceGHS, 35);
  assert.equal(legacy[2].active, false);
  assert.equal(legacy[2].name, 'Custom premium');
  assert.equal(planAccess(legacy[0]).aiAssistant, false);
  assert.equal(plansSchema.safeParse(PLAN_CATALOG).success, true);
  assert.equal(
    plansSchema.safeParse(PLAN_CATALOG.map((p) => (p.id === 'free' ? { ...p, active: false } : p)))
      .success,
    false,
  );
  assert.equal(
    plansSchema.safeParse(
      PLAN_CATALOG.map((p) => (p.id === 'premium' ? { ...p, aiCredits: null } : p)),
    ).success,
    false,
  );
});

test('tiers enforce feature access, including direct calls, and mock receipts never claim money was paid', () => {
  for (const plan of PLAN_CATALOG) {
    const userId = `tier-${plan.id}`;
    const snapshot = subscriptionService.activateMock(userId, plan.id, 'mobile-money', now);
    for (const feature of ['pdfReports', 'aiAssistant', 'cropDoctor', 'yieldPredictor']) {
      if (planAccess(plan)[feature])
        assert.doesNotThrow(() => subscriptionService.assertFeature(userId, feature, now));
      else
        assert.throws(
          () => subscriptionService.assertFeature(userId, feature, now),
          /not included/,
        );
    }
    if (plan.id !== 'free') {
      assert.equal(snapshot.subscription.payment.status, 'simulated');
      assert.equal(snapshot.subscription.payment.amountGHS, plan.priceGHS);
      assert.match(snapshot.subscription.payment.reference, /^DEMO-/);
      assert.equal(snapshot.subscription.expiresAt, '2026-11-15T12:00:00.000Z');
    }
  }
  assert.equal(subscriptionService.get('new-account', now).subscription.planId, 'free');
});

test('questions and scans share a budget; reservations prevent overspend and failures refund only once', () => {
  storage.set(
    PLATFORM_KEYS.plans,
    PLAN_CATALOG.map((p) => (p.id === 'premium' ? { ...p, aiCredits: 6 } : p)),
  );
  subscriptionService.activateMock('metered', 'premium', 'card', now);
  const question = subscriptionService.reserve('metered', 'aiAssistant', now);
  const scan = subscriptionService.reserve('metered', 'cropDoctor', now);
  assert.equal(subscriptionService.get('metered', now).creditsRemaining, 0);
  assert.throws(() => subscriptionService.reserve('metered', 'aiAssistant', now), /Not enough/);
  subscriptionService.settle(question, true, now);
  subscriptionService.settle(scan, false, now);
  subscriptionService.settle(scan, false, now);
  assert.equal(subscriptionService.get('metered', now).creditsUsed, 1);
  assert.equal(subscriptionService.get('metered', now).creditsRemaining, 5);
  subscriptionService.activateMock('metered', 'premium', 'card', now);
  assert.equal(
    subscriptionService.get('metered', now).creditsUsed,
    1,
    'renewing does not mint more credits',
  );
  storage.remove(PLATFORM_KEYS.plans);
});

test('Advanced has unlimited credits, while switching plans preserves existing monthly usage', () => {
  subscriptionService.activateMock('advanced-user', 'advanced', 'card', now);
  for (let i = 0; i < 21; i++)
    subscriptionService.settle(
      subscriptionService.reserve('advanced-user', 'cropDoctor', now),
      true,
      now,
    );
  assert.equal(subscriptionService.get('advanced-user', now).creditsRemaining, null);
  subscriptionService.activateMock('advanced-user', 'premium', 'card', now);
  assert.equal(subscriptionService.get('advanced-user', now).creditsRemaining, 0);
  assert.throws(
    () => subscriptionService.reserve('advanced-user', 'aiAssistant', now),
    /Not enough/,
  );
});

test('credits reset at the calendar month boundary, expired subscriptions become Free, and month-end billing dates clamp', () => {
  subscriptionService.activateMock('expiry', 'premium', 'card', now);
  const hold = subscriptionService.reserve('expiry', 'cropDoctor', now);
  subscriptionService.settle(hold, true, now);
  assert.equal(subscriptionService.get('expiry', new Date('2026-11-01T00:00:00Z')).creditsUsed, 0);
  assert.equal(
    subscriptionService.get('expiry', new Date('2026-11-15T12:00:00Z')).subscription.planId,
    'free',
  );
  assert.throws(
    () => subscriptionService.assertFeature('expiry', 'pdfReports', new Date('2026-11-16')),
    /not included/,
  );
  assert.equal(
    nextBillingDate(new Date('2026-01-31T12:34:00Z')).toISOString(),
    '2026-02-28T12:34:00.000Z',
  );
  assert.equal(
    nextBillingDate(new Date('2028-01-31T12:34:00Z')).toISOString(),
    '2028-02-29T12:34:00.000Z',
  );
});

test('hiding a plan stops new activations without revoking active subscribers; feature shutdown still takes priority', () => {
  subscriptionService.activateMock('already-paid', 'premium', 'card', now);
  storage.set(
    PLATFORM_KEYS.plans,
    PLAN_CATALOG.map((p) => (p.id === 'premium' ? { ...p, active: false } : p)),
  );
  assert.throws(
    () => subscriptionService.activateMock('new-subscriber', 'premium', 'card', now),
    /not available/,
  );
  assert.doesNotThrow(() => subscriptionService.assertFeature('already-paid', 'aiAssistant', now));
  storage.set(PLATFORM_KEYS.flags, { ...DEFAULT_FLAGS, aiAssistant: false });
  assert.throws(
    () => subscriptionService.reserve('already-paid', 'aiAssistant', now),
    /currently unavailable/,
  );
  storage.remove(PLATFORM_KEYS.flags);
  storage.remove(PLATFORM_KEYS.plans);
});

test('unused pending reservations expire and account usage stays separate', () => {
  subscriptionService.activateMock('abandoned', 'premium', 'card', now);
  subscriptionService.reserve('abandoned', 'cropDoctor', now);
  assert.equal(
    subscriptionService.get('abandoned', new Date(now.getTime() + 11 * 60_000)).creditsUsed,
    0,
  );
  assert.equal(subscriptionService.get('someone-else', now).creditsUsed, 0);
  assert.equal(subscriptionService.get('someone-else', now).subscription.planId, 'free');
});

test('a mock checkout cannot activate a plan for a changed session or in read-only mode', async () => {
  await useSubscriptionStore.getState().load('checkout-a');
  const pending = useSubscriptionStore.getState().checkoutMock('premium', 'card');
  await useSubscriptionStore.getState().load('checkout-b');
  await assert.rejects(pending, /session changed/);
  assert.equal(subscriptionService.get('checkout-a').subscription.planId, 'free');
  assert.equal(useSubscriptionStore.getState().snapshot.subscription.userId, 'checkout-b');
  useAuthStore.setState({ impersonation: { farmerId: 'checkout-b' } });
  try {
    await assert.rejects(
      useSubscriptionStore.getState().checkoutMock('premium', 'card'),
      /Read-only/,
    );
  } finally {
    useAuthStore.setState({ impersonation: null });
  }
});

test('failed storage does not activate a subscription or consume credits', () => {
  const original = localStorage.setItem;
  const warn = console.warn;
  console.warn = () => {};
  localStorage.setItem = () => {
    throw new Error('Quota exceeded');
  };
  try {
    assert.throws(
      () => subscriptionService.activateMock('storage-full', 'premium', 'card', now),
      /Could not save/,
    );
  } finally {
    localStorage.setItem = original;
    console.warn = warn;
  }
  assert.equal(subscriptionService.get('storage-full', now).subscription.planId, 'free');
});
