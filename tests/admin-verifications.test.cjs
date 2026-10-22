/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-verifications.test.cjs
// Phase A9: the verifications queue. Approving raises the farmer's score, rejections reach the
// farmer with a reason, duplicate cards are found by hash, and the queue can be cleared in order.
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
const { hashGhanaCard } = require('../lib/admin/card-hash.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const {
  canBulkApprove,
  duplicateWarning,
  findDuplicates,
  googleMapsUrl,
  isOverdue,
  neighborId,
  nextAfterReview,
  parseLocation,
  queueCounts,
  queueSortValue,
  REJECT_REASONS,
} = require('../lib/admin/verification-queue.ts');
const { rejectionMessage } = require('../lib/verification.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');

const STRONG = 'Harvest#2026!';

/** The queue as the page shows it on the Pending tab: oldest first. */
async function pendingQueue() {
  const list = await verificationsService.list({ status: 'pending' });
  return list.sort((a, b) => queueSortValue(a).localeCompare(queueSortValue(b)));
}

test('setup: sign in as super admin', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
});

test('the queue lists the oldest pending request first; overdue ones are flagged', async () => {
  const queue = await pendingQueue();
  assert.equal(queue.length, 12);
  for (let i = 1; i < queue.length; i++) {
    assert.ok(queue[i - 1].submittedAt <= queue[i].submittedAt, 'oldest first');
  }
  const all = await verificationsService.list();
  const sorted = [...all].sort((a, b) => queueSortValue(a).localeCompare(queueSortValue(b)));
  assert.ok(
    sorted.slice(0, 12).every((v) => v.status === 'pending'),
    'the All tab still puts pending first',
  );
  assert.deepEqual(queueCounts(all), {
    pending: 12,
    approved: all.filter((v) => v.status === 'approved').length,
    rejected: all.filter((v) => v.status === 'rejected').length,
    all: all.length,
  });

  const now = new Date('2026-05-10T12:00:00Z');
  const request = { status: 'pending', submittedAt: '2026-05-07T11:00:00Z' };
  assert.equal(isOverdue(request, now), true, 'older than 3 days is overdue');
  assert.equal(isOverdue({ ...request, submittedAt: '2026-05-08T12:00:00Z' }, now), false);
  assert.equal(isOverdue({ ...request, status: 'approved' }, now), false);
});

test('approving a Ghana Card verifies the profile and raises the score (audited)', async () => {
  const queue = await pendingQueue();
  const card = queue.find((v) => v.kind === 'ghanaCard');
  const before = await farmersService.get(card.userId);
  assert.equal(before.profile.verification.ghanaCard, false);

  await verificationsService.approve(card.id);
  const after = await farmersService.get(card.userId);
  assert.equal(after.profile.verification.ghanaCard, true, 'profile shows Verified');
  assert.equal(after.profile.ghanaCardLast4, card.submittedValue.replace(/\D/g, ''));
  assert.ok(after.stats.score > before.stats.score, `${before.stats.score} → ${after.stats.score}`);
  if (before.status === 'pending_verification') assert.equal(after.status, 'active');

  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'verification.approve');
  assert.equal(entry.targetId, card.userId);
  assert.deepEqual([entry.before, entry.after], [{ status: 'pending' }, { status: 'approved' }]);
  await assert.rejects(() => verificationsService.approve(card.id), /already been reviewed/);
});

test('rejecting needs a listed reason; the farmer sees it and can resubmit', async () => {
  const card = (await pendingQueue()).find((v) => v.kind === 'ghanaCard');
  await assert.rejects(() => verificationsService.reject(card.id, 'Because'), /Choose a reason/);
  await assert.rejects(() => verificationsService.reject(card.id, 'Other', ''), /Add a note/);
  assert.deepEqual(
    [...REJECT_REASONS],
    ['Number format invalid', "Doesn't match name", 'Duplicate', 'Unclear', 'Other'],
  );

  await verificationsService.reject(card.id, 'Unclear', 'The photo is blurred.');
  const entry = readAuditLog().at(-1);
  assert.equal(entry.action, 'verification.reject');
  assert.deepEqual(entry.after, {
    status: 'rejected',
    reason: 'Unclear',
    note: 'The photo is blurred.',
  });

  // What the farmer's profile shows (verification-grid uses rejectionMessage).
  const [latest] = await verificationsService.listForFarmer(card.userId);
  assert.equal(latest.status, 'rejected');
  assert.equal(
    rejectionMessage(latest),
    'Rejected: Unclear. Please resubmit. The photo is blurred.',
  );
  assert.equal(
    rejectionMessage({ reason: "Doesn't match name" }),
    "Rejected: Doesn't match name. Please resubmit.",
  );

  // …and they can submit again, which puts them back in the queue.
  const again = await verificationsService.submit(card.userId, 'ghanaCard', 'GHA-918273645-1');
  assert.equal(again.status, 'pending');
  assert.ok((await pendingQueue()).some((v) => v.id === again.id));
});

test('the planted duplicate card warns, by hash only', async () => {
  const farmers = await farmersService.list();
  const all = await verificationsService.list();
  const yaw = farmers.find((f) => f.profile.name === 'Yaw Asante');
  const flagged = all.filter(
    (v) =>
      v.status === 'pending' &&
      findDuplicates(v, all, farmers).some((d) => d.userId === yaw.userId),
  );
  assert.equal(flagged.length, 1, 'one other account submitted Yaw Asante’s card');
  const warning = duplicateWarning(findDuplicates(flagged[0], all, farmers));
  assert.equal(warning, 'This Ghana Card is also linked to 1 other account (Yaw Asante)');

  // Yaw's own request warns the other way round.
  const yawRequest = all.find((v) => v.userId === yaw.userId && v.kind === 'ghanaCard');
  const other = farmers.find((f) => f.userId === flagged[0].userId);
  assert.deepEqual(findDuplicates(yawRequest, all, farmers), [
    { userId: other.userId, name: other.profile.name },
  ]);

  // Hashes, never numbers: SHA-256 hex on every card request, and no full number in storage.
  assert.ok(
    all.filter((v) => v.kind === 'ghanaCard').every((v) => /^[0-9a-f]{64}$/.test(v.valueHash)),
  );
  assert.ok(![...local.map.values()].some((value) => /GHA-\d{9}-\d/.test(value)));

  // Two farmers submitting the same number are linked, whatever the letter case.
  const waiting = new Set(all.filter((v) => v.status === 'pending').map((v) => v.userId));
  const [a, b] = farmers.filter(
    (f) => f.status === 'active' && !f.profile.verification.ghanaCard && !waiting.has(f.userId),
  );
  const first = await verificationsService.submit(a.userId, 'ghanaCard', 'GHA-555444333-2');
  const second = await verificationsService.submit(b.userId, 'ghanaCard', 'gha-555444333-2');
  assert.equal(first.valueHash, await hashGhanaCard('GHA-555444333-2'));
  assert.equal(first.valueHash, second.valueHash);
  const now = await verificationsService.list();
  assert.deepEqual(
    findDuplicates(second, now, farmers).map((d) => d.userId),
    [a.userId],
  );
  // A rejected submission no longer counts as a link.
  await verificationsService.reject(first.id, 'Duplicate');
  assert.deepEqual(findDuplicates(second, await verificationsService.list(), farmers), []);
});

test('J/K and A/R: five requests cleared in queue order without skipping any', async () => {
  let queue = await pendingQueue();
  const startCount = queue.length;
  // J/K move through the list as shown.
  assert.equal(neighborId(queue, queue[0].id, 1), queue[1].id);
  assert.equal(neighborId(queue, queue[1].id, -1), queue[0].id);
  assert.equal(neighborId(queue, queue[0].id, -1), null, 'nothing before the first');

  let current = queue[0].id;
  const seen = [];
  for (let i = 0; i < 5; i++) {
    seen.push(current);
    const request = queue.find((v) => v.id === current);
    // A approves; R rejects (with a reason) — alternate, like a reviewer would.
    if (i % 2 === 0) await verificationsService.approve(request.id);
    else await verificationsService.reject(request.id, 'Unclear');
    const next = nextAfterReview(queue, current);
    queue = await pendingQueue();
    if (i < 4) {
      assert.ok(next, 'the next pending request loads');
      assert.equal(next, queue[0].id, 'it is the oldest one left');
      current = next;
    }
  }
  assert.equal(new Set(seen).size, 5);
  assert.equal(queue.length, startCount - 5);
  // The last pending request has nowhere to go: the review closes.
  assert.equal(nextAfterReview([{ id: 'x', status: 'pending' }], 'x'), null);
});

test('phone and location checks approve in bulk; Ghana Cards never do', async () => {
  const queue = await pendingQueue();
  const bulk = queue.filter(canBulkApprove);
  assert.ok(bulk.length >= 2, 'seeded phone and location checks are waiting');
  assert.ok(bulk.every((v) => v.kind !== 'ghanaCard'));
  const card = queue.find((v) => v.kind === 'ghanaCard');
  assert.equal(canBulkApprove(card), false);

  // Mixing in a card refuses the whole batch, and nothing changes.
  await assert.rejects(
    () => verificationsService.approveMany([bulk[0].id, card.id]),
    /reviewed one by one/,
  );
  assert.equal((await verificationsService.list({ status: 'pending' })).length, queue.length);

  const auditBefore = readAuditLog().length;
  const done = await verificationsService.approveMany(bulk.map((v) => v.id));
  assert.equal(done.length, bulk.length);
  assert.equal(readAuditLog().length, auditBefore + bulk.length, 'one audit entry each');
  for (const v of bulk) {
    const farmer = await farmersService.get(v.userId);
    assert.equal(farmer.profile.verification[v.kind], true, `${v.kind} verified`);
  }
});

test('locations open in Google Maps; analysts cannot review', async () => {
  assert.deepEqual(parseLocation('6.7000, -1.6000'), { lat: 6.7, lng: -1.6 });
  assert.equal(parseLocation('Kumasi'), null);
  assert.equal(parseLocation('95, 10'), null);
  assert.equal(
    googleMapsUrl({ lat: 6.7, lng: -1.6 }),
    'https://www.google.com/maps/search/?api=1&query=6.7,-1.6',
  );

  const [request] = await pendingQueue();
  await adminAuthService.signOut();
  await adminAuthService.signIn('yaw.darko@agrictec.app', DEMO_PASSWORDS.team);
  await assert.rejects(() => verificationsService.list(), /permission/i);
  await assert.rejects(() => verificationsService.approve(request.id), /permission/i);
  await assert.rejects(() => verificationsService.approveMany([request.id]), /permission/i);
  await adminAuthService.signOut();

  // Support staff can.
  await adminAuthService.signIn('kofi.adjei@agrictec.app', DEMO_PASSWORDS.team);
  assert.ok((await verificationsService.list({ status: 'pending' })).length > 0);
});
