/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/assistant.test.cjs
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

// Exercise the actual TypeScript modules with Node's test runner, without a test dependency.
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

const { getAssistantReply } = require('../lib/ai/assistant-replies.ts');
const { calculateCreditScore } = require('../lib/calculations/credit-score.ts');
const { formatGHS } = require('../lib/format.ts');
const { defaultProfile } = require('../services/profile.service.ts');
const { chatService } = require('../services/chat.service.ts');
const { marketService } = require('../services/market.service.ts');
const { useChatStore } = require('../store/chat-store.ts');
const { useFarmStore } = require('../store/farm-store.ts');
const { useProfileStore } = require('../store/profile-store.ts');
const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MessageContent } = require('../components/assistant/message-content.tsx');

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
global.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };

const ctx = {
  farmerName: 'Ama',
  region: 'Northern',
  primaryCrops: ['Maize', 'Cassava'],
  score: 612,
  income: 4500,
  expenses: 1500,
  recordCount: 7,
  creditFactors: {
    score: 612,
    paymentHistory: 80,
    recordCompleteness: 60,
    incomeStability: 50,
    momoActivity: 10,
    verification: 75,
  },
};

test('all eleven topics return structured content and quick prompts route correctly', async () => {
  const cases = [
    ['  MAIZE planting  ', 'Maize Planting in Ghana'],
    ['Pest control', 'Fall Armyworm Control'],
    ['Credit tips', 'Improve Your Credit Score'],
    ['Cocoa prices', 'Cocoa Prices'],
    ['Weather', 'Weather Intelligence'],
    ['fertiliser NPK', 'Fertilizer Guide'],
    ['My finances', 'Your Farm Finances'],
    ['cassava', 'Cassava Tips'],
    ['hello', 'Akwaaba, Ama!'],
    ['thank you', 'You’re welcome!'],
    ['something unfamiliar', 'Let me help'],
  ];
  const replies = await Promise.all(
    cases.map(async ([message, title]) => {
      const reply = await getAssistantReply(message, ctx);
      assert.equal(reply.title, title);
      assert.doesNotMatch(JSON.stringify(reply), /\p{Extended_Pictographic}/u);
      assert.ok(
        Object.keys(reply).every((key) => ['title', 'intro', 'bullets', 'tip'].includes(key)),
      );
      return reply;
    }),
  );
  assert.match(replies[0].tip, /Northern.*May–June/);
  assert.match(replies[2].intro, /612 \(Fair\)/);
  assert.match(replies[2].intro, /weakest factor is MoMo Activity \(10%\)/);
  assert.equal(replies[2].bullets.length, 5);
  assert.match(replies[2].bullets[0], /MoMo Activity/);
  assert.match(replies[3].intro, /mock prices/);
  assert.equal(replies[3].tip, 'Check COCOBOD for official farmgate prices');
  assert.equal(replies[7].bullets.length, 4);
  assert.match(replies[10].intro, /MoFA/);
});

test('first-match routing, personal finances and zero-income handling', async () => {
  const [first, finance, empty] = await Promise.all([
    getAssistantReply('when to plant maize with pest damage', ctx),
    getAssistantReply('what are my profits', ctx),
    getAssistantReply('income and expenses', { ...ctx, income: 0, expenses: 200, recordCount: 1 }),
  ]);
  assert.equal(first.title, 'Maize Planting in Ghana');
  assert.deepEqual(finance.bullets, [
    'Total income: GHS 4,500.',
    'Total expenses: GHS 1,500.',
    'Net profit: GHS 3,000.',
    'Profit margin: 66.7%.',
  ]);
  assert.match(empty.bullets[2], /-GHS 200/);
  assert.match(empty.bullets[3], /no income recorded/);
  assert.doesNotMatch(JSON.stringify(empty), /NaN|Infinity/);
});

test('weather uses market.service values and condition-specific advice', async () => {
  const original = marketService.getWeather;
  marketService.getWeather = async () => ({
    condition: 'storm',
    description: 'Test storm',
    temp: 24,
    humidity: 88,
    rainChance: 90,
  });
  try {
    const reply = await getAssistantReply('rain', ctx);
    assert.match(reply.intro, /Test storm, 24°C, 88% humidity and 90%/);
    assert.match(reply.intro, /simulated/);
    assert.match(reply.bullets.join(' '), /drainage.*thunderstorms/);
  } finally {
    marketService.getWeather = original;
  }
});

test('React escapes both user text and every structured reply field', () => {
  const html = '<b>hi</b><script>alert(1)</script>';
  const plain = renderToStaticMarkup(createElement(MessageContent, { content: html }));
  assert.match(plain, /&lt;b&gt;hi&lt;\/b&gt;/);
  assert.doesNotMatch(plain, /<b>|<script>/);
  const structured = renderToStaticMarkup(
    createElement(MessageContent, {
      content: { title: html, intro: html, bullets: [html], tip: html },
    }),
  );
  assert.doesNotMatch(structured, /<b>|<script>/);
  assert.match(structured, /<ul/);
  assert.match(structured, /<li\b/);
  assert.match(structured, /Tip:/);
});

test('saved assistant emoji prefixes render as icons while user text stays intact', () => {
  const content = {
    title: '\u{1F33D} Maize Planting in Ghana',
    intro: 'Growing advice \u{1F331}',
    tip: '\u{1F4A1} Test your soil.',
  };
  const rendered = renderToStaticMarkup(createElement(MessageContent, { content }));
  assert.doesNotMatch(rendered, /\p{Extended_Pictographic}/u);
  assert.match(rendered, /lucide-sprout/);
  assert.match(rendered, /lucide-lightbulb/);
  assert.match(rendered, /Maize Planting in Ghana/);
  const user = renderToStaticMarkup(
    createElement(MessageContent, { content: 'My maize \u{1F33D}', isAssistant: false }),
  );
  assert.match(user, /My maize \u{1F33D}/u);
});

test('chat uses current farm data, blocks overlapping sends, persists, reloads and clears', async () => {
  const userId = 'assistant-test';
  const profile = {
    ...defaultProfile(userId),
    name: 'Ama',
    region: 'Northern',
    primaryCrops: ['Maize'],
  };
  const records = [
    {
      id: 'sale',
      userId,
      type: 'income',
      crop: 'Maize',
      amount: 8000,
      description: 'Sale',
      date: '2026-10-18',
      createdAt: '2026-10-18T12:00:00Z',
    },
    {
      id: 'cost',
      userId,
      type: 'expense',
      crop: 'Maize',
      amount: 2400,
      description: 'Inputs',
      date: '2026-10-18',
      createdAt: '2026-10-18T12:00:00Z',
    },
  ];
  useFarmStore.setState({ userId, records, momo: [], status: 'ready' });
  useProfileStore.setState({ userId, profile, status: 'ready' });
  await useChatStore.getState().load(userId);
  assert.equal(useChatStore.getState().messages.length, 1);
  assert.match(useChatStore.getState().messages[0].content, /Akwaaba!/);

  await useChatStore.getState().sendMessage('   ');
  assert.equal(useChatStore.getState().messages.length, 1);

  const pending = useChatStore.getState().sendMessage('how is my credit score');
  assert.equal(useChatStore.getState().isTyping, true);
  await useChatStore.getState().sendMessage('duplicate');
  assert.equal(useChatStore.getState().messages.length, 2);
  await pending;
  assert.equal(useChatStore.getState().isTyping, false);
  const actualScore = calculateCreditScore(records, [], profile).score;
  assert.match(
    useChatStore.getState().messages.at(-1).content.intro,
    new RegExp(`Your score is ${actualScore}`),
  );

  await useChatStore.getState().sendMessage('what are my profits');
  const answer = useChatStore.getState().messages.at(-1).content;
  assert.ok(answer.bullets.includes(`Total income: ${formatGHS(8000)}.`));
  assert.ok(answer.bullets.includes(`Total expenses: ${formatGHS(2400)}.`));
  assert.ok(answer.bullets.includes('Profit margin: 70.0%.'));

  await useChatStore.getState().sendMessage('x'.repeat(600));
  assert.equal(useChatStore.getState().messages.at(-2).content.length, 500);
  const saved = useChatStore.getState().messages;
  assert.deepEqual(await chatService.list(userId), saved);
  useChatStore.setState({ messages: [] });
  await useChatStore.getState().load(userId);
  assert.deepEqual(useChatStore.getState().messages, saved);
  await useChatStore.getState().clear();
  assert.equal(useChatStore.getState().messages.length, 1);
  assert.equal((await chatService.list(userId)).length, 1);
  await useChatStore.getState().load(userId);
  assert.equal(useChatStore.getState().messages.length, 1);
});

test('reply or save failure leaves a friendly message, resets typing and allows retry', async () => {
  const originalWeather = marketService.getWeather;
  marketService.getWeather = async () => {
    throw new Error('Weather unavailable');
  };
  try {
    await useChatStore.getState().sendMessage('weather');
    assert.equal(useChatStore.getState().isTyping, false);
    assert.equal(
      useChatStore.getState().messages.at(-1).content.title,
      'Sorry, something went wrong. Please try again.',
    );
    assert.deepEqual(await chatService.list('assistant-test'), useChatStore.getState().messages);
  } finally {
    marketService.getWeather = originalWeather;
  }
  const originalSave = chatService.save;
  chatService.save = async () => {
    throw new Error('Save failed');
  };
  try {
    await useChatStore.getState().sendMessage('hello');
    assert.equal(useChatStore.getState().isTyping, false);
    assert.equal(
      useChatStore.getState().messages.at(-1).content.title,
      'Sorry, something went wrong. Please try again.',
    );
    await assert.rejects(useChatStore.getState().clear());
    assert.equal(useChatStore.getState().status, 'ready');
  } finally {
    chatService.save = originalSave;
  }
  await useChatStore.getState().sendMessage('thanks');
  assert.equal(useChatStore.getState().messages.at(-1).content.title, 'You’re welcome!');
});

test('an old reply cannot leak into another user or reset their typing state', async () => {
  const pending = useChatStore.getState().sendMessage('weather');
  await useChatStore.getState().load('another-assistant-test');
  const nextPending = useChatStore.getState().sendMessage('hello');
  await pending;
  assert.equal(useChatStore.getState().isTyping, true);
  await nextPending;
  assert.equal(useChatStore.getState().messages.length, 3);
  assert.equal(useChatStore.getState().messages.at(-1).content.title, 'Akwaaba, Farmer!');
  assert.equal(useChatStore.getState().isTyping, false);
});
