/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-auth.test.cjs
// Phase A4: admin sign-in, password policy, lockout, idle timeout and proxy rules.
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

const { NextRequest } = require('next/server');
const { proxy } = require('../proxy.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { ADMIN_IDLE_MS, getCurrentAdmin } = require('../lib/admin/admin-session.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const {
  changePasswordSchema,
  safeAdminNext,
} = require('../components/admin/auth/admin-auth-schemas.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { teamService } = require('../services/admin/team.service.ts');
const { authService } = require('../services/auth.service.ts');

const STRONG = 'Harvest#2026!';

/** Runs the proxy for a path with the given cookies; returns the redirect target or 'next'. */
function route(pathname, cookies = {}) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  const response = proxy(
    new NextRequest(`http://localhost${pathname}`, { headers: cookie ? { cookie } : {} }),
  );
  const location = response.headers.get('location');
  if (!location) return 'next';
  const url = new URL(location);
  return url.pathname + url.search;
}

test('proxy: admin and farmer doors are separate', () => {
  // /admin while logged out → the admin login, remembering where to go.
  assert.equal(route('/admin'), '/admin-login?next=%2Fadmin');
  assert.equal(route('/admin/farmers'), '/admin-login?next=%2Fadmin%2Ffarmers');
  // A farmer session never opens the console.
  assert.equal(route('/admin', { agrictec_session: '1' }), '/admin-login?next=%2Fadmin');
  // The admin login is open without any farmer session…
  assert.equal(route('/admin-login'), 'next');
  // …and a signed-in admin is sent on to the console.
  assert.equal(route('/admin-login', { agrictec_admin: '1' }), '/admin');
  assert.equal(route('/admin/team', { agrictec_admin: '1', agrictec_role: 'analyst' }), 'next');
  // Farmer rules are unchanged.
  assert.equal(route('/dashboard'), '/login?next=%2Fdashboard');
  assert.equal(route('/dashboard', { agrictec_admin: '1' }), '/login?next=%2Fdashboard');
  const onboarded = { agrictec_session: '1', agrictec_onboarded: '1' };
  assert.equal(route('/login', onboarded), '/dashboard');
  assert.equal(route('/signup', { agrictec_session: '1' }), 'next');
  assert.equal(route('/records', onboarded), 'next');
  // Onboarding: the app stays closed until the farm setup is finished.
  assert.equal(route('/login', { agrictec_session: '1' }), '/onboarding');
  assert.equal(route('/records', { agrictec_session: '1' }), '/onboarding');
  assert.equal(route('/onboarding', { agrictec_session: '1' }), 'next');
  assert.equal(route('/onboarding', onboarded), '/dashboard');
  assert.equal(route('/onboarding'), '/login');
});

test('forms: safe "next" paths and the new-password policy', () => {
  assert.equal(safeAdminNext('/admin/farmers'), '/admin/farmers');
  assert.equal(safeAdminNext('//evil.example'), '/admin');
  assert.equal(safeAdminNext('https://evil.example'), '/admin');
  assert.equal(safeAdminNext('/dashboard'), '/admin');
  assert.equal(safeAdminNext('/administrator'), '/admin');
  const check = (newPassword, currentPassword = 'Admin@2026') =>
    changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword: newPassword })
      .success;
  assert.equal(check('Short#1a'), false, 'under 10 characters');
  assert.equal(check('nouppercase#1'), false);
  assert.equal(check('NOLOWERCASE#1'), false);
  assert.equal(check('NoNumberHere#'), false);
  assert.equal(check('NoSymbol12345'), false);
  assert.equal(check('Admin@2026xyz'), true);
  assert.equal(check('Admin@2026xyz', 'Admin@2026xyz'), false, 'same as the old one');
});

test('first login forces a password change; login is audited', async () => {
  const session = await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  assert.equal(session.admin.mustChangePassword, true);
  assert.equal(readAuditLog().at(-1).action, 'admin.login');
  assert.match(document.cookie, /agrictec_admin=1|agrictec_role/);

  await assert.rejects(
    () => adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'weak#12345'),
    /an uppercase letter/,
  );
  await assert.rejects(
    () => adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'Short#1A'),
    /at least 10 characters/,
  );
  const admin = await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, STRONG);
  assert.equal(admin.mustChangePassword, false);
  assert.equal(readAuditLog().at(-1).action, 'admin.password_change');
  assert.ok(admin.lastLoginAt, 'lastLoginAt is recorded');
});

test('errors never reveal which accounts exist', async () => {
  await adminAuthService.signOut();
  // A farmer's email gets exactly the same message as an unknown one.
  await authService.signUp('farmer.ama@farm.gh', 'Password1');
  await authService.signOut();
  await assert.rejects(
    () => adminAuthService.signIn('farmer.ama@farm.gh', 'Password1'),
    /^Error: Incorrect email or password\. 4 attempts left\.$/,
  );
  await assert.rejects(
    () => adminAuthService.signIn('nobody@agrictec.app', 'Password1'),
    /^Error: Incorrect email or password\. 3 attempts left\.$/,
  );

  // A disabled admin sees the disabled message, but only with the right password.
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG);
  const analyst = (await teamService.list()).find((a) => a.role === 'analyst');
  await teamService.disable(analyst.id);
  await adminAuthService.signOut();
  await assert.rejects(
    () => adminAuthService.signIn(analyst.email, 'WrongPassword1!'),
    /Incorrect email or password/,
  );
  await assert.rejects(() => adminAuthService.signIn(analyst.email, DEMO_PASSWORDS.team), {
    message: 'This admin account is disabled.',
  });
  local.removeItem('agrictec:admin-lockout');
});

test('five failed attempts lock the form with a countdown', async () => {
  for (let i = 4; i >= 1; i--) {
    await assert.rejects(
      () => adminAuthService.signIn(SUPER_ADMIN_EMAIL, 'wrong-password'),
      new RegExp(`${i} attempts? left`),
    );
  }
  await assert.rejects(
    () => adminAuthService.signIn(SUPER_ADMIN_EMAIL, 'wrong-password'),
    /^Error: Too many attempts\. Try again in [45]:\d\d\.$/,
  );
  // Locked: even the right password is refused until the countdown ends.
  await assert.rejects(() => adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG), /Too many/);
  const lock = await adminAuthService.isLocked();
  assert.equal(lock.locked, true);
  const minutesLeft = (Date.parse(lock.until) - Date.now()) / 60_000;
  assert.ok(minutesLeft > 4.9 && minutesLeft <= 5);
  local.removeItem('agrictec:admin-lockout');
});

test('an idle session ends after the timeout and is logged; activity keeps it alive', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG);
  const key = 'agrictec:admin-session';
  const stored = JSON.parse(local.getItem(key));

  // Activity moves the clock forward.
  const before = stored.lastActivityAt;
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok((await adminAuthService.touch()) > before);

  // Idle for the full timeout (30 minutes by default).
  const idleSince = new Date(Date.now() - ADMIN_IDLE_MS - 1000).toISOString();
  local.setItem(key, JSON.stringify({ ...stored, lastActivityAt: idleSince }));
  assert.equal(getCurrentAdmin(), null, 'an idle session grants nothing');
  const state = await adminAuthService.sessionState();
  assert.deepEqual(state, { session: null, expired: true });
  const logout = readAuditLog().at(-1);
  assert.equal(logout.action, 'admin.logout');
  assert.match(logout.summary, /after inactivity/);
  assert.equal(local.getItem(key), null);
  assert.equal(await adminAuthService.touch(), null);
});

test('admin sign-out ends only the admin session, never the farmer one', async () => {
  const farmer = await authService.signIn('farmer.ama@farm.gh', 'Password1');
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, STRONG);
  await adminAuthService.signOut();
  assert.equal(readAuditLog().at(-1).action, 'admin.logout');
  assert.equal(await adminAuthService.getSession(), null);
  const still = await authService.getSession();
  assert.equal(still.userId, farmer.userId, 'the farmer is still signed in');
  assert.equal(still.role, 'farmer');
  // And the farmer session gives no admin access.
  assert.equal(getCurrentAdmin(), null);

  const actions = readAuditLog().map((e) => e.action);
  assert.ok(actions.includes('admin.login') && actions.includes('admin.logout'));
});
