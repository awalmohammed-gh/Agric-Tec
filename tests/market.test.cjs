/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/market.test.cjs
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

const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MARKET_PRICES } = require('../data/mock/market-prices.ts');
const { WEATHER_CONDITIONS } = require('../data/mock/weather.ts');
const { getWeatherAdvice } = require('../lib/ai/weather-advisory.ts');
const { isPrimaryCrop, sortMarketPrices, percentageSeries } = require('../lib/market/data.ts');
const { DemoDataNotice } = require('../components/market/demo-data-notice.tsx');
const { WeatherCard } = require('../components/market/weather-card.tsx');
const { WeatherAdvisory } = require('../components/market/weather-advisory.tsx');
const { MarketPrices } = require('../components/market/market-prices.tsx');
const { PriceTrendChart } = require('../components/market/price-trend-chart.tsx');
const { CROP_ICONS } = require('../components/ui/crop-icon.tsx');

const sessionValues = new Map();
const sessionStorage = {
  getItem: (key) => sessionValues.get(key) ?? null,
  setItem: (key, value) => sessionValues.set(key, value),
};
global.window = { sessionStorage };
const freshService = () => {
  delete require.cache[require.resolve('../services/market.service.ts')];
  return require('../services/market.service.ts').marketService;
};

test('weather and its timestamp survive repeat requests, navigation and a same-tab reload', async () => {
  sessionValues.clear();
  const random = Math.random;
  let picks = 0;
  Math.random = () => {
    picks++;
    return 0;
  };
  try {
    const service = freshService();
    const [first, concurrent] = await Promise.all([service.getWeather(), service.getWeather()]);
    assert.deepEqual(first, concurrent);
    assert.equal(first.condition, 'sunny');
    assert.ok(Number.isFinite(Date.parse(first.updatedAt)));
    assert.deepEqual(await service.getWeather(), first);
    assert.deepEqual(await freshService().getWeather(), first);
    const mutable = await service.getWeather();
    mutable.temp = 999;
    assert.equal((await service.getWeather()).temp, first.temp);
    assert.equal(picks, 1);

    // A fresh module and a fresh session represent opening a new tab.
    sessionValues.clear();
    Math.random = () => {
      picks++;
      return 0.99;
    };
    const anotherTab = await freshService().getWeather();
    assert.equal(anotherTab.condition, 'storm');
    assert.equal(picks, 2);
  } finally {
    Math.random = random;
  }
});

test('old weather snapshots get a stable timestamp and malformed snapshots are replaced', async () => {
  sessionValues.set('agrictec:weather', JSON.stringify(WEATHER_CONDITIONS[2]));
  const restored = await freshService().getWeather();
  assert.equal(restored.condition, 'showers');
  assert.ok(restored.updatedAt);
  assert.deepEqual(await freshService().getWeather(), restored);
  sessionValues.set(
    'agrictec:weather',
    JSON.stringify({ condition: 'not-a-condition', temp: 'hot' }),
  );
  const replaced = await freshService().getWeather();
  assert.ok(WEATHER_CONDITIONS.some((weather) => weather.condition === replaced.condition));
  assert.ok(Number.isFinite(replaced.temp));
});

test('weather stays stable in memory when session storage is unavailable', async () => {
  const warn = console.warn;
  console.warn = () => {};
  window.sessionStorage = {
    getItem() {
      throw new Error('Unavailable');
    },
    setItem() {
      throw new Error('Unavailable');
    },
  };
  try {
    const service = freshService();
    const first = await service.getWeather();
    assert.deepEqual(await service.getWeather(), first);
  } finally {
    window.sessionStorage = sessionStorage;
    console.warn = warn;
  }
});

test('prices and six-month histories are repeatable and Rice uses the actual listed price', async () => {
  const service = freshService();
  const prices = await service.getPrices();
  const original = prices.map((price) => ({ ...price }));
  prices[0].price = -1;
  prices.reverse();
  assert.deepEqual(await service.getPrices(), original);
  const crops = ['Maize', 'Rice', 'Cocoa', 'Groundnut'];
  const first = await service.getPriceTrends(crops, 6);
  assert.deepEqual(await freshService().getPriceTrends(crops, 6), first);
  assert.equal(first.labels.length, 6);
  assert.deepEqual(
    first.series.map((series) => series.prices.at(-1)),
    [320, 550, 1350, 600],
  );
  assert.ok(
    first.series.every(
      (series) => series.prices.length === 6 && series.prices.every((price) => price > 0),
    ),
  );
});

test('advisory applies strict rain, humidity and heat thresholds and personalizes crop advice', () => {
  const boundary = {
    condition: 'partly-cloudy',
    temp: 30,
    humidity: 75,
    rainChance: 60,
    description: 'Demo',
  };
  assert.equal(getWeatherAdvice(boundary, []).length, 1);
  const wetHot = getWeatherAdvice({ ...boundary, temp: 31, humidity: 76, rainChance: 61 }, [
    'Maize',
    'Cocoa',
  ]);
  const text = wetHot.map((advice) => advice.text).join(' ');
  assert.match(
    text,
    /Heavy rain expected\. Delay spraying and fertilizer; secure harvested crops\./,
  );
  assert.match(text, /High humidity raises fungal disease risk/);
  assert.match(text, /High heat\. Irrigate early morning or late evening\./);
  assert.match(text, /your Cocoa crop/);
  assert.match(text, /Maize/);
  assert.match(text, /Rice \(local\) prices up 8\.1%/);
  assert.ok(wetHot.every((advice) => advice.icon));

  const planting = getWeatherAdvice({ ...boundary, temp: 26, rainChance: 29 }, []);
  assert.match(
    planting.map((advice) => advice.text).join(' '),
    /Good conditions for land preparation and planting/,
  );
  assert.equal(getWeatherAdvice({ ...boundary, temp: 25, rainChance: 29 }, []).length, 1);
  assert.equal(getWeatherAdvice({ ...boundary, temp: 26, rainChance: 30 }, []).length, 1);
  // Even mild weather with no triggered weather rule mentions the user's own crops.
  assert.match(getWeatherAdvice(WEATHER_CONDITIONS[1], ['Maize']).at(-1).text, /Maize \+5\.2%/);
});

test('market advice handles empty or falling prices without claiming an increase', () => {
  const falling = getWeatherAdvice(
    WEATHER_CONDITIONS[1],
    [],
    [
      { crop: 'Maize', unit: 'bag', price: 320, change: -5 },
      { crop: 'Rice', unit: 'bag', price: 550, change: -2 },
    ],
  ).at(-1).text;
  assert.match(falling, /Rice has the smallest price decline at 2%/);
  assert.doesNotMatch(falling, /prices up/);
  assert.match(
    getWeatherAdvice(WEATHER_CONDITIONS[1], [], []).at(-1).text,
    /prices are unavailable/,
  );
});

test('crop matching, all three sorts, and percentage comparison preserve original data', () => {
  assert.equal(isPrimaryCrop('Rice (local)', ['rice']), true);
  assert.equal(isPrimaryCrop('Maize', ['Cocoa']), false);
  const before = JSON.stringify(MARKET_PRICES);
  assert.equal(sortMarketPrices(MARKET_PRICES, 'name')[0].crop, 'Cassava');
  assert.equal(sortMarketPrices(MARKET_PRICES, 'price')[0].crop, 'Cocoa');
  assert.equal(sortMarketPrices(MARKET_PRICES, 'change')[0].crop, 'Rice (local)');
  assert.equal(JSON.stringify(MARKET_PRICES), before);
  assert.deepEqual(percentageSeries([100, 125, 80]), [0, 25, -20]);
  assert.deepEqual(percentageSeries([1000, 1250, 800]), [0, 25, -20]);
  assert.deepEqual(percentageSeries([0, 20]), [0, 0]);
  assert.deepEqual(percentageSeries([]), []);
});

test('demo notice, regional weather and highlighted primary crops render with distinct icons', () => {
  const notice = renderToStaticMarkup(createElement(DemoDataNotice));
  assert.match(notice, /Indicative prices and weather — demo data/);
  assert.match(notice, /Live data sources will be connected/);
  const weather = { ...WEATHER_CONDITIONS[0], updatedAt: '2026-10-18T14:35:00.000Z' };
  const regional = renderToStaticMarkup(createElement(WeatherCard, { weather, region: 'Ashanti' }));
  assert.match(regional, /Ashanti, Ghana/);
  assert.match(regional, /Last updated:/);
  assert.match(regional, /2026-10-18T14:35:00.000Z/);
  assert.match(
    renderToStaticMarkup(createElement(WeatherCard, { weather })),
    /Greater Accra, Ghana/,
  );
  const market = renderToStaticMarkup(
    createElement(MarketPrices, { prices: MARKET_PRICES, primaryCrops: ['Maize'] }),
  );
  const rows = market.match(/<li\b[\s\S]*?<\/li>/g);
  assert.equal(rows.length, 8);
  const maize = rows.find((row) => row.includes('title="Maize"'));
  assert.match(maize, /Your crop/);
  assert.match(maize, /border-accent\/50/);
  assert.equal(rows.filter((row) => row.includes('Your crop')).length, 1);
  assert.equal(new Set(Object.values(CROP_ICONS)).size, Object.values(CROP_ICONS).length);
  assert.match(market, /Biggest change/);
  assert.match(market, /AI Forecast/);
  const advisory = renderToStaticMarkup(
    createElement(WeatherAdvisory, { weather, primaryCrops: ['Maize'], prices: MARKET_PRICES }),
  );
  assert.match(advisory, /AI Weather Advisory/);
  assert.match(advisory, /Maize/);
});

test('trend chart exposes an accessible percent toggle, correct units and a data table', async () => {
  const trends = await freshService().getPriceTrends(['Maize', 'Rice', 'Cocoa', 'Groundnut'], 6);
  const chart = renderToStaticMarkup(
    createElement(PriceTrendChart, { trends, prices: MARKET_PRICES }),
  );
  assert.match(chart, /role="switch"/);
  assert.match(chart, /aria-checked="false"/);
  assert.match(chart, /Show percentage change instead of absolute prices/);
  assert.match(chart, /50kg bag/);
  assert.match(chart, /View price data/);
  assert.match(chart, /GHS 550/);
  assert.match(chart, /GHS 1,350/);
  assert.equal((chart.match(/<tbody>[\s\S]*?<\/tbody>/)?.[0].match(/<tr\b/g) ?? []).length, 6);
});
