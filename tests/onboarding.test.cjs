/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/onboarding.test.cjs
// Farmer onboarding: the six steps' rules, the resumable draft, the final save (with a Ghana
// Card stored only as a mask and a hash), the proxy hint, and loans locked without a card.
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
// Cookies: remember the last value written per name, like a browser.
const jar = new Map();
globalThis.document = {
  get cookie() {
    return [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  },
  set cookie(text) {
    const [pair, ...attrs] = text.split(';').map((s) => s.trim());
    const [name, value] = pair.split('=');
    if (attrs.some((a) => a === 'max-age=0') || !value) jar.delete(name);
    else jar.set(name, value);
  },
};
const local = globalThis.window.localStorage;

const {
  CONSTITUENCIES,
  constituenciesOf,
  isConstituencyOf,
} = require('../constants/constituencies.ts');
const { CROPS, YIELD_CROPS } = require('../constants/crops.ts');
const { REGIONS } = require('../constants/regions.ts');
const schemas = require('../components/onboarding/onboarding-schemas.ts');
const { hashGhanaCard } = require('../lib/admin/card-hash.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { resolveAssistantReply } = require('../lib/ai/assistant-replies.ts');
const { calculateCreditScore } = require('../lib/calculations/credit-score.ts');
const { checkEligibility, LOANS_LOCKED_HINT } = require('../lib/calculations/loan.ts');
const {
  formatFarmSize,
  maskFullGhanaCard,
  normalizeProfile,
  toAcres,
} = require('../lib/profile.ts');
const { proxy } = require('../proxy.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');
const { authService } = require('../services/auth.service.ts');
const { loansService } = require('../services/loans.service.ts');
const { onboardingService } = require('../services/onboarding.service.ts');
const { profileService } = require('../services/profile.service.ts');

const CARD = 'GHA-123456789-0';

function route(pathname, cookies = {}) {
  const url = new URL(pathname, 'http://localhost');
  const request = {
    nextUrl: url,
    url: url.toString(),
    cookies: { has: (name) => name in cookies },
  };
  const response = proxy(request);
  const location = response.headers.get('location');
  return location ? new URL(location).pathname : 'next';
}

test('every region has its constituencies, sorted and unique', () => {
  let total = 0;
  for (const region of REGIONS) {
    const list = constituenciesOf(region);
    assert.ok(list.length > 0, `${region} has constituencies`);
    assert.deepEqual(
      list,
      [...list].sort((a, b) => a.localeCompare(b)),
      `${region} is sorted`,
    );
    assert.equal(new Set(list).size, list.length, `${region} has no duplicates`);
    total += list.length;
  }
  assert.equal(Object.keys(CONSTITUENCIES).length, 16);
  // 276 in the EC's list; one Ashanti seat is left out until it is checked (see the file).
  assert.equal(total, 275);
  assert.ok(isConstituencyOf('Northern', 'Tamale North'));
  assert.ok(!isConstituencyOf('Ashanti', 'Tamale North'));
});

test('step rules: farm name, location, size, crops, farm type, Ghana Card', () => {
  const ok = (schema, value) => schema.safeParse(value).success;
  // 1. Farm name: 2–80 characters.
  assert.ok(!ok(schemas.farmNameSchema, { farmName: 'A', useNameAsFarmName: false }));
  assert.ok(ok(schemas.farmNameSchema, { farmName: 'Owusu Farm', useNameAsFarmName: false }));
  assert.ok(!ok(schemas.farmNameSchema, { farmName: 'x'.repeat(81), useNameAsFarmName: false }));
  // 2. Location: the constituency must belong to the region; a pin must be inside Ghana.
  const place = { region: 'Ashanti', constituency: 'Ejisu', community: '', gps: null };
  assert.ok(ok(schemas.locationSchema, place));
  assert.ok(!ok(schemas.locationSchema, { ...place, constituency: '' }));
  assert.ok(!ok(schemas.locationSchema, { ...place, constituency: 'Tamale North' }));
  assert.ok(ok(schemas.locationSchema, { ...place, gps: { lat: 6.7, lng: -1.5 } }));
  const outside = schemas.locationSchema.safeParse({ ...place, gps: { lat: 51.5, lng: -0.1 } });
  assert.equal(outside.success, false);
  assert.equal(outside.error.issues[0].message, 'This location is outside Ghana.');
  // 3. Size: more than 0, up to 10,000.
  assert.ok(!ok(schemas.farmSizeSchema, { size: 0, sizeUnit: 'acres' }));
  assert.ok(!ok(schemas.farmSizeSchema, { size: 10_001, sizeUnit: 'acres' }));
  assert.ok(ok(schemas.farmSizeSchema, { size: 2, sizeUnit: 'hectares' }));
  // 4. Crops: at least one; "Other" needs a name.
  assert.ok(!ok(schemas.cropsSchema, { primaryCrops: [], otherCrops: '' }));
  assert.ok(ok(schemas.cropsSchema, { primaryCrops: ['Maize', 'Pepper', 'Okra'], otherCrops: '' }));
  assert.ok(!ok(schemas.cropsSchema, { primaryCrops: ['Other'], otherCrops: '' }));
  assert.ok(ok(schemas.cropsSchema, { primaryCrops: ['Other'], otherCrops: 'Garden eggs' }));
  // 5. A cooperative needs its name; an out-grower's company is optional.
  const type = { cooperativeName: '', outgrowerCompany: '' };
  assert.ok(!ok(schemas.farmTypeSchema, { ...type, farmType: 'Cooperative' }));
  assert.ok(
    ok(schemas.farmTypeSchema, {
      ...type,
      farmType: 'Cooperative',
      cooperativeName: 'Ejura Co-op',
    }),
  );
  assert.ok(ok(schemas.farmTypeSchema, { ...type, farmType: 'Out-grower' }));
  // 6. A card must match GHA-XXXXXXXXX-X and be confirmed; "later" needs nothing.
  const card = { choice: 'have', cardNumber: CARD, confirmOwner: true, savedMasked: '' };
  assert.ok(ok(schemas.ghanaCardStepSchema, card));
  assert.ok(!ok(schemas.ghanaCardStepSchema, { ...card, confirmOwner: false }));
  assert.ok(!ok(schemas.ghanaCardStepSchema, { ...card, cardNumber: 'GHA-12345-0' }));
  assert.ok(ok(schemas.ghanaCardStepSchema, { ...card, choice: 'later', cardNumber: '' }));
  // New crops are offered everywhere, but only crops with yield data in the predictor.
  assert.ok(CROPS.includes('Oil Palm') && CROPS.includes('Vegetables'));
  assert.ok(!YIELD_CROPS.includes('Pepper'));
});

test('2 hectares is stored as ≈ 4.94 acres and shown back as "2 hectares"', () => {
  const patch = schemas.farmSizePatch({ size: 2, sizeUnit: 'hectares' });
  assert.equal(patch.acres, 4.9421);
  assert.equal(patch.sizeUnit, 'hectares');
  assert.equal(formatFarmSize(patch.acres, 'hectares'), '2 hectares');
  assert.equal(schemas.farmSizeDefaults(patch).size, 2);
  assert.equal(toAcres(5, 'acres'), 5);
});

test('a new signup must onboard: the proxy sends every app page to /onboarding', () => {
  const session = { agrictec_session: '1' };
  assert.equal(route('/dashboard', session), '/onboarding');
  assert.equal(route('/loans', session), '/onboarding');
  assert.equal(route('/onboarding', session), 'next');
  assert.equal(route('/onboarding', { ...session, agrictec_onboarded: '1' }), '/dashboard');
  assert.equal(route('/onboarding'), '/login');
  assert.equal(route('/dashboard', { ...session, agrictec_onboarded: '1' }), 'next');
});

let userId;

test('setup: the admin console is installed (its first sign-in seeds the demo data)', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'Harvest#2026!');
});

test('the draft resumes on the same step with the same answers', async () => {
  const session = await authService.signUp('abena@example.com', 'Harvest#2026');
  userId = session.userId;
  await profileService.save(userId, {
    ...(await profileService.get(userId)),
    name: 'Abena Mensah',
    email: session.email,
  });
  assert.equal(await onboardingService.isComplete(userId), false);
  assert.ok(!jar.has('agrictec_onboarded'));

  const answers = {
    farmName: 'Abena Mensah',
    useNameAsFarmName: true,
    region: 'Ashanti',
    constituency: 'Ejura-Sekyedumase',
    community: 'Ejura',
    gps: { lat: 7.3856, lng: -1.3562 },
    ...schemas.farmSizePatch({ size: 2, sizeUnit: 'hectares' }),
  };
  await onboardingService.saveDraft(userId, 3, answers);
  const draft = await onboardingService.getDraft(userId);
  assert.equal(draft.currentStep, 3);
  assert.deepEqual(draft.data, answers);
});

test('completing saves everything; the card is stored only as a mask and a hash', async () => {
  const hash = await hashGhanaCard(CARD);
  const data = {
    ...(await onboardingService.getDraft(userId)).data,
    primaryCrops: ['Maize', 'Other'],
    otherCrops: 'Garden eggs',
    farmType: 'Cooperative',
    cooperativeName: 'Ejura Maize Farmers',
    ghanaCard: { status: 'pending', masked: maskFullGhanaCard(CARD), hash },
  };
  await onboardingService.saveDraft(userId, schemas.REVIEW_STEP, data);
  const profile = await onboardingService.complete(userId, data);

  assert.ok(profile.onboardingCompletedAt);
  assert.equal(profile.verification.location, true, 'a pin verifies the location');
  assert.equal(profile.ghanaCard.status, 'pending');
  assert.equal(profile.ghanaCard.masked, 'GHA-******789-0');
  assert.equal(profile.ghanaCard.hash, hash);
  assert.equal(profile.verification.ghanaCard, false, 'not verified until an admin approves');
  assert.equal(profile.sizeUnit, 'hectares');
  assert.equal(profile.otherCrops, 'Garden eggs');
  assert.equal(await onboardingService.getDraft(userId), null, 'draft cleared');
  assert.equal(jar.get('agrictec_onboarded'), '1');
  assert.equal(await onboardingService.destinationAfterSignIn(userId, '/records'), '/records');

  // The full number appears nowhere in storage.
  for (let i = 0; i < local.length; i++) {
    const value = local.getItem(local.key(i));
    assert.ok(!value.includes('123456789'), `${local.key(i)} has no full card number`);
  }
  // The admin's queue has it, pending.
  const queued = (await verificationsService.list({ userId, kind: 'ghanaCard' }))[0];
  assert.equal(queued.status, 'pending');
  assert.equal(queued.valueHash, hash);
});

test('loans stay locked until the card is verified; approving unlocks them', async () => {
  const pending = await profileService.get(userId);
  const locked = checkEligibility({
    amount: 0,
    records: [],
    score: 800,
    rules: { minRecords: 0, minScore: 0, maxProfitMultiplier: 3 },
    ghanaCard: pending.ghanaCard.status,
  });
  assert.equal(locked.eligible, false);
  assert.equal(locked.issues[0].code, 'ghana-card');
  await assert.rejects(
    () =>
      loansService.submitApplication(
        userId,
        { partnerId: 'x', amount: 1000, purpose: 'Seeds', months: 12, monthly: 100 },
        700,
      ),
    /being reviewed/,
  );

  // The assistant never promises a loan to an unverified farmer.
  const reply = await resolveAssistantReply('Can I get a loan?', {
    farmerName: 'Abena',
    region: 'Ashanti',
    primaryCrops: ['Maize'],
    score: 700,
    income: 0,
    expenses: 0,
    recordCount: 0,
    ghanaCard: 'not_provided',
  });
  assert.equal(reply.reply.tip, LOANS_LOCKED_HINT);

  const before = calculateCreditScore([], [], pending).score;
  const request = (await verificationsService.list({ userId, kind: 'ghanaCard' }))[0];
  await verificationsService.approve(request.id);
  const verified = await profileService.get(userId);
  assert.equal(verified.ghanaCard.status, 'verified');
  assert.equal(verified.verification.ghanaCard, true);
  assert.ok(calculateCreditScore([], [], verified).score > before, 'a verified card counts');
  const open = checkEligibility({
    amount: 0,
    records: [],
    score: 800,
    rules: { minRecords: 0, minScore: 0, maxProfitMultiplier: 3 },
    ghanaCard: verified.ghanaCard.status,
  });
  assert.equal(open.eligible, true);
});

test('skipping the card still opens the app; older profiles are upgraded', async () => {
  const session = await authService.signUp('kojo@example.com', 'Harvest#2026');
  const profile = await onboardingService.complete(session.userId, {
    farmName: 'Kojo Farm',
    useNameAsFarmName: false,
    region: 'Volta',
    constituency: 'Hohoe',
    acres: 3,
    sizeUnit: 'acres',
    primaryCrops: ['Rice'],
    farmType: 'Smallholder',
    ghanaCard: { status: 'not_provided' },
  });
  assert.equal(profile.ghanaCard.status, 'not_provided');
  assert.equal(profile.verification.location, false, 'no pin, no location check');
  assert.equal(await onboardingService.isComplete(session.userId), true);

  // A cooperative without its name is refused, also at the final save.
  await assert.rejects(
    () =>
      onboardingService.complete(session.userId, {
        ...profile,
        farmType: 'Cooperative',
        cooperativeName: undefined,
      }),
    /cooperative/,
  );

  // A profile saved before onboarding existed: a verified card kept as its last four digits.
  const legacy = normalizeProfile('old-user', {
    name: 'Ama',
    ghanaCardLast4: '7890',
    verification: { phone: true, location: false, ghanaCard: true },
  });
  assert.deepEqual(legacy.ghanaCard, { status: 'verified', masked: 'GHA-******789-0' });
  assert.equal(legacy.verification.ghanaCard, true);
  assert.equal(legacy.onboardingCompletedAt, undefined, 'they go through onboarding once');
});
