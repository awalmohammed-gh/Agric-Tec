/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-content.test.cjs
// Phase A12: content the admin edits (prices, weather, crops, the assistant, crop diagnoses)
// reaches the farmer app, and announcements reach exactly their audience at the right time.
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
const {
  announcementState,
  canDelete,
  canEdit,
  canEnd,
  estimateReach,
  inAudience,
  tabOf,
} = require('../lib/admin/announcements.ts');
const { duplicateKeywords, moveItem, byPriority } = require('../lib/admin/assistant-kb.ts');
const { kgPerUnit, marketReference } = require('../lib/admin/crop-pricing.ts');
const { ASSISTANT_FALLBACK_ID } = require('../lib/admin/defaults.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { resolveAssistantReply } = require('../lib/ai/assistant-replies.ts');
const { diagnoseCrop } = require('../lib/ai/crop-diagnosis.ts');
const { getWeatherAdvice } = require('../lib/ai/weather-advisory.ts');
const { predictYield } = require('../lib/calculations/yield.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { announcementsService } = require('../services/admin/announcements.service.ts');
const { contentService } = require('../services/admin/content.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { marketService } = require('../services/market.service.ts');
const { storage } = require('../services/storage.ts');

const STRONG = 'Harvest#2026!';
const HOUR = 60 * 60_000;
const iso = (offset) => new Date(Date.now() + offset).toISOString();
const ctx = {
  farmerName: 'Abena',
  region: 'Northern',
  primaryCrops: ['Maize'],
  score: 640,
  income: 24000,
  expenses: 15000,
  recordCount: 18,
};
const baseInput = {
  title: 'Dry spell this week',
  message: 'Little rain is expected. Mulch to keep soil moisture.',
  type: 'warning',
  audience: { kind: 'all' },
  startsAt: iso(-60_000),
  active: true,
  dismissible: true,
};

test('setup: sign in as super admin', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
});

test('a maize price change reaches the market page and the yield revenue', async () => {
  const prices = await contentService.getMarketPrices();
  await contentService.saveMarketPrices(
    prices.map((p) => (p.crop === 'Maize' ? { ...p, price: 400 } : p)),
  );
  const market = await marketService.getPrices();
  assert.equal(market.find((p) => p.crop === 'Maize').price, 400);

  // The crops page reads the market's price per tonne and copies it to the yield data.
  const reference = marketReference('Maize', market);
  assert.equal(reference.perTonne, 4000);
  const crops = await contentService.getCrops();
  const input = {
    crop: 'Maize',
    acres: 2,
    fertilizer: 'none',
    irrigation: 'rainfed',
    season: 'major',
  };
  const before = predictYield(input, crops).revenue;
  const saved = await contentService.saveCrops(
    crops.map((c) => (c.crop === 'Maize' ? { ...c, pricePerTonne: reference.perTonne } : c)),
  );
  const after = predictYield(input, saved);
  assert.equal(after.pricePerTonne, 4000);
  assert.equal(after.revenue, Math.round(after.expected * 4000));
  assert.ok(after.revenue > before);

  const meta = await contentService.getContentMeta();
  assert.ok(meta[PLATFORM_KEYS.market]?.by && meta[PLATFORM_KEYS.crops]?.at);
  const actions = readAuditLog().map((e) => e.action);
  assert.ok(actions.includes('content.market') && actions.includes('content.crops'));
});

test('market units convert to a price per tonne only when they are weights', () => {
  assert.equal(kgPerUnit('100kg bag'), 100);
  assert.equal(kgPerUnit('64 kg bag'), 64);
  assert.equal(kgPerUnit('tonne'), 1000);
  assert.equal(kgPerUnit('bunch'), null);
  const prices = [{ crop: 'Rice (local)', unit: '50kg bag', price: 550, change: 0 }];
  assert.equal(marketReference('Rice', prices).perTonne, 11000);
  assert.equal(marketReference('Yam', prices), null);
});

test('a storm override changes the weather and the advisory', async () => {
  const storm = {
    condition: 'storm',
    temp: 24,
    description: 'Thunderstorms',
    humidity: 90,
    rainChance: 95,
  };
  await contentService.saveWeatherOverride(storm);
  const weather = await marketService.getWeather();
  assert.equal(weather.condition, 'storm');
  assert.equal(weather.rainChance, 95);
  const advice = getWeatherAdvice(weather, ['Maize']).map((a) => a.text);
  assert.ok(advice.some((text) => /Heavy rain expected/.test(text)));
  await assert.rejects(() => contentService.saveWeatherOverride({ ...storm, humidity: 140 }));
  await contentService.saveWeatherOverride(null);
});

test('a KB "irrigation" reply with {name} answers in the console and the farmer assistant', async () => {
  const kb = await contentService.getAssistantKb();
  const item = {
    id: 'kb-irrigation',
    keywords: ['irrigation'],
    reply: { title: 'Watering your farm', intro: 'Hi {name}, water early in the morning.' },
    active: true,
    priority: 999,
  };
  const saved = await contentService.saveAssistantKb([item, ...kb]);
  const resolved = await resolveAssistantReply('Any irrigation advice?', ctx, { knowledge: saved });
  assert.equal(resolved.item.id, 'kb-irrigation');
  assert.equal(resolved.reply.intro, 'Hi Abena, water early in the morning.');

  // No match: the admin's fallback answers.
  const none = await resolveAssistantReply('zzz qqq', ctx, { knowledge: saved });
  assert.equal(none.item, null);
  const fallback = saved.find((k) => k.id === ASSISTANT_FALLBACK_ID);
  assert.equal(none.reply.title, fallback.reply.title);
});

test('the fallback reply cannot be deleted and duplicate keywords are found', async () => {
  const kb = await contentService.getAssistantKb();
  await assert.rejects(
    () => contentService.saveAssistantKb(kb.filter((k) => k.id !== ASSISTANT_FALLBACK_ID)),
    /fallback reply can.t be deleted/,
  );
  const twin = { ...kb.find((k) => k.id === 'kb-irrigation'), id: 'kb-twin', priority: 5 };
  twin.reply = { title: 'Twin' };
  assert.deepEqual(
    duplicateKeywords([...kb, twin])
      .find((d) => d.keyword === 'irrigation')
      .titles.sort(),
    ['Twin', 'Watering your farm'],
  );
  // Reordering never moves the fallback from the end.
  const ordered = byPriority(moveItem(kb, 0, 1));
  assert.equal(ordered.at(-1).id, ASSISTANT_FALLBACK_ID);
});

test('a diagnosis confidence range and prevention tips reach the crop doctor', async () => {
  const items = await contentService.getDiagnoses();
  const only = {
    id: 'dx-test',
    disease: 'Test Blight',
    crop: 'Tomato',
    severity: 'High',
    confidence: 85,
    confidenceMin: 80,
    confidenceMax: 90,
    treatment: 'Remove infected leaves. Spray a copper fungicide.',
    prevention: ['Rotate crops', 'Space plants for airflow'],
    active: true,
  };
  const saved = await contentService.saveDiagnoses([
    ...items.map((d) => ({ ...d, active: false })),
    only,
  ]);
  const file = { name: 'leaf.jpg', size: 2048, type: 'image/jpeg' };
  const result = await diagnoseCrop(file, 'Tomato', saved);
  assert.equal(result.disease, 'Test Blight');
  assert.ok(result.confidence >= 80 && result.confidence <= 90);
  assert.deepEqual(result.prevention, ['Rotate crops', 'Space plants for airflow']);
  await assert.rejects(() =>
    contentService.saveDiagnoses([{ ...only, confidenceMin: 95, confidenceMax: 90 }]),
  );
  await assert.rejects(
    () => contentService.saveDiagnoses(saved.map((d) => ({ ...d, active: false }))),
    /at least one diagnosis active/,
  );
  await contentService.saveDiagnoses(items);
});

test('a Northern-only announcement reaches a Northern farmer but not an Ashanti one', async () => {
  const created = await announcementsService.create({
    ...baseInput,
    audience: { kind: 'region', regions: ['Northern'] },
  });
  const northern = await announcementsService.activeFor({ region: 'Northern', primaryCrops: [] });
  const ashanti = await announcementsService.activeFor({ region: 'Ashanti', primaryCrops: [] });
  assert.ok(northern.some((a) => a.id === created.id));
  assert.ok(!ashanti.some((a) => a.id === created.id));

  const farmers = await farmersService.list();
  const expected = farmers.filter((f) => !f.isGuest && f.profile.region === 'Northern').length;
  assert.ok(expected > 0);
  assert.equal(estimateReach(created.audience, farmers), expected);
  assert.equal(
    inAudience({ kind: 'crop', crops: ['Cocoa'] }, { region: 'X', primaryCrops: ['Cocoa'] }),
    true,
  );
});

test('one scheduled for tomorrow does not show yet, and only it can be edited', async () => {
  const tomorrow = await announcementsService.create({ ...baseInput, startsAt: iso(24 * HOUR) });
  assert.equal(announcementState(tomorrow), 'scheduled');
  assert.equal(tabOf(announcementState(tomorrow)), 'scheduled');
  const live = await announcementsService.listLive();
  assert.ok(!live.some((a) => a.id === tomorrow.id));
  assert.ok(canEdit(tomorrow) && canDelete(tomorrow) && canEnd(tomorrow));

  const edited = await announcementsService.update(tomorrow.id, { title: 'Dry spell next week' });
  assert.equal(edited.title, 'Dry spell next week');

  const now = await announcementsService.create(baseInput);
  assert.equal(announcementState(now), 'live');
  assert.ok(!canEdit(now) && !canDelete(now));
  await assert.rejects(
    () => announcementsService.update(now.id, { title: 'Changed' }),
    /scheduled/,
  );
  await assert.rejects(() => announcementsService.remove(now.id), /End it before deleting/);

  const ended = await announcementsService.end(now.id);
  assert.equal(announcementState(ended), 'ended');
  assert.ok(!canEnd(ended) && canDelete(ended));
  await announcementsService.remove(now.id);
  assert.ok(!(await announcementsService.list()).some((a) => a.id === now.id));
});

test('a critical announcement to everyone needs an extra confirmation', async () => {
  const critical = { ...baseInput, type: 'critical' };
  const before = readAuditLog().length;
  await assert.rejects(
    () => announcementsService.create(critical),
    /Confirm sending a critical announcement/,
  );
  assert.equal(readAuditLog().length, before);
  const sent = await announcementsService.create(critical, { confirmedCritical: true });
  assert.equal(sent.type, 'critical');
  // Critical to one region is fine without it.
  await announcementsService.create({
    ...critical,
    audience: { kind: 'region', regions: ['Volta'] },
  });
  // Messages are capped at 300 characters.
  await assert.rejects(() =>
    announcementsService.create({ ...baseInput, message: 'x'.repeat(301) }),
  );
  assert.ok(storage.get(PLATFORM_KEYS.announcements, []).length > 0);
});
