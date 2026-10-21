/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test --test-isolation=none tests/admin-shell.test.cjs
// Phase A5: role-filtered navigation, page-level guards, search and shared admin components.
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

const { createElement } = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const {
  ADMIN_NAV_ITEMS,
  findAdminNavItem,
  getAdminNavForRole,
} = require('../constants/admin-navigation.ts');
const { ADMIN_ROLES, can, ROLE_PERMISSIONS } = require('../lib/admin/permissions.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { NoAccess } = require('../components/admin/layout/no-access.tsx');
const { searchConsole } = require('../components/admin/layout/admin-search.tsx');
const { adminBreadcrumbs } = require('../components/admin/layout/admin-breadcrumbs.ts');
const {
  STATUS_STYLES,
  announcementState,
  statusStyle,
} = require('../components/admin/shared/status-badge.tsx');
const { diffEntries } = require('../components/admin/shared/json-diff.tsx');
const { pageWindow } = require('../components/admin/shared/pagination.tsx');
const { LOAN_STATUSES } = require('../lib/admin/loan-status.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { lendersService } = require('../services/admin/lenders.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { teamService } = require('../services/admin/team.service.ts');

const labelsFor = (role) => getAdminNavForRole(role).flatMap((s) => s.items.map((i) => i.label));

test('navigation is correct for all 4 roles', () => {
  assert.equal(labelsFor('super_admin').length, ADMIN_NAV_ITEMS.length, 'super admin sees all');
  assert.deepEqual(labelsFor('analyst'), [
    'Dashboard',
    'All Farmers',
    'Loan Applications',
    'Reports & Analytics',
  ]);
  assert.deepEqual(labelsFor('support'), [
    'Dashboard',
    'All Farmers',
    'Verifications',
    'Risk & Fraud',
    'Loan Applications',
  ]);
  const admin = labelsFor('admin');
  for (const hidden of ['Credit Rules', 'Team & Roles', 'System Settings']) {
    assert.ok(!admin.includes(hidden), `admin can't see ${hidden}`);
  }
  assert.ok(admin.includes('Audit Log') && admin.includes('Lenders'));
  // Each role sees exactly the items its permissions allow, and no empty sections.
  for (const role of ADMIN_ROLES) {
    const expected = ADMIN_NAV_ITEMS.filter((i) => ROLE_PERMISSIONS[role].includes(i.permission));
    assert.deepEqual(
      labelsFor(role),
      expected.map((i) => i.label),
    );
    assert.ok(getAdminNavForRole(role).every((s) => s.items.length > 0));
  }
  assert.deepEqual(labelsFor('farmer'), []);
});

test('every admin route is protected at page level with its own permission', () => {
  const pagesDir = path.join(root, 'app', '(admin)', 'admin');
  const pages = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'page.tsx') pages.push(full);
    }
  })(pagesDir);

  const routes = pages.map((file) => {
    const rel = path.relative(pagesDir, path.dirname(file)).split(path.sep).filter(Boolean);
    return { file, route: ['/admin', ...rel].join('/').replace('[id]', 'some-id') };
  });
  // Every nav item has a page, and every page is guarded by the nav item's permission.
  for (const item of ADMIN_NAV_ITEMS) {
    assert.ok(
      routes.some((r) => r.route === item.href),
      `page exists for ${item.href}`,
    );
  }
  for (const { file, route } of routes) {
    const source = fs.readFileSync(file, 'utf8');
    const item = findAdminNavItem(route);
    assert.ok(item, `${route} belongs to a nav item`);
    assert.match(
      source,
      new RegExp(`permission="${item.permission.replace('.', '\\.')}"`),
      `${route} checks ${item.permission}`,
    );
    assert.match(source, /AdminPlaceholder|RequirePermission/, `${route} renders through a guard`);
    if (route.includes('some-id')) assert.match(source, /await params/, `${route} awaits params`);
  }
});

test('a typed-in URL without permission shows NoAccess', () => {
  assert.equal(can('analyst', 'credit.configure'), false);
  const html = renderToStaticMarkup(
    createElement(NoAccess, { role: 'analyst', pageLabel: 'Credit Rules' }),
  );
  assert.match(html, /You don(&#x27;|')t have access to this page/);
  assert.match(html, /Your role \(Analyst\) can(&#x27;|')t open Credit Rules/);
  assert.match(html, /Back to Overview/);
});

test('an invited analyst signs in and sees only their four sections', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, 'Harvest#2026!');
  const { admin, temporaryPassword } = await teamService.invite(
    'Test Analyst',
    'test.analyst@agrictec.app',
    'analyst',
  );
  assert.equal(admin.role, 'analyst');
  await adminAuthService.signOut();
  const session = await adminAuthService.signIn('test.analyst@agrictec.app', temporaryPassword);
  assert.equal(session.admin.mustChangePassword, true);
  await adminAuthService.changePassword(temporaryPassword, 'Analyst#2026!');
  const { role } = (await adminAuthService.getSession()).admin;
  assert.deepEqual(labelsFor(role), [
    'Dashboard',
    'All Farmers',
    'Loan Applications',
    'Reports & Analytics',
  ]);
  // The services agree with the nav: an analyst can't open the team.
  await assert.rejects(() => teamService.list(), /permission/);
});

test('Ctrl+K search finds farmers, applications and lenders the role may open', async () => {
  await adminAuthService.signOut();
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, 'Harvest#2026!');
  const farmers = await farmersService.list();
  const applications = await loanApplicationsService.list();
  const lenders = await lendersService.list({ includeInactive: true });
  const data = { farmers, applications, lenders };

  const akosua = searchConsole('akosua', data, 'super_admin');
  assert.ok(akosua.some((hit) => hit.kind === 'farmer' && hit.title === 'Akosua Mensah'));
  assert.equal(
    akosua.find((hit) => hit.title === 'Akosua Mensah').href.startsWith('/admin/farmers/'),
    true,
  );

  const target = farmers.find((f) => !f.isGuest);
  assert.ok(
    searchConsole(target.email.slice(0, 8), data, 'super_admin').some(
      (h) => h.id === target.userId,
    ),
  );
  const local = target.profile.phone.replace('+233', '0');
  assert.ok(
    searchConsole(local, data, 'support').some((h) => h.id === target.userId),
    'phone, local format',
  );

  const app = applications[0];
  const byRef = searchConsole(app.reference.toLowerCase(), data, 'analyst');
  assert.equal(byRef[0].kind, 'application');
  assert.equal(byRef[0].href, `/admin/loans/${app.id}`);

  assert.ok(searchConsole('sinapi', data, 'super_admin').some((h) => h.kind === 'lender'));
  assert.equal(searchConsole('sinapi', data, 'analyst').length, 0, 'analysts can’t open lenders');
  assert.equal(searchConsole('a', data, 'super_admin').length, 0, 'needs two characters');
  assert.equal(searchConsole('akosua', data, undefined).length, 0, 'no role, no results');
});

test('breadcrumbs name the record on detail pages', async () => {
  const farmers = await farmersService.list();
  const applications = await loanApplicationsService.list();
  const akosua = farmers.find((f) => f.profile.name === 'Akosua Mensah');
  const crumbs = (p) => adminBreadcrumbs(p, { farmers, applications }).map((c) => c.label);
  assert.deepEqual(crumbs(`/admin/farmers/${akosua.userId}`), [
    'Farmers',
    'All Farmers',
    'Akosua Mensah',
  ]);
  assert.deepEqual(crumbs(`/admin/loans/${applications[0].id}`), [
    'Lending',
    'Loan Applications',
    applications[0].reference,
  ]);
  assert.deepEqual(crumbs('/admin/credit-rules'), ['Lending', 'Credit Rules']);
  assert.deepEqual(crumbs('/admin'), ['Overview', 'Dashboard']);
  assert.equal(
    adminBreadcrumbs('/admin/farmers/x', { farmers, applications })[1].href,
    '/admin/farmers',
  );
});

test('shared components: one status map, JSON diff and pagination window', () => {
  for (const status of LOAN_STATUSES) assert.ok(statusStyle('loan', status).label);
  for (const kind of Object.keys(STATUS_STYLES)) {
    for (const style of Object.values(STATUS_STYLES[kind])) {
      assert.ok(['green', 'red', 'blue', 'gold', 'purple'].includes(style.color), `${kind} colour`);
    }
  }
  const now = new Date('2026-06-01T12:00:00.000Z');
  const base = { active: true, startsAt: '2026-05-01T00:00:00.000Z' };
  assert.equal(announcementState({ ...base }, now), 'live');
  assert.equal(
    announcementState({ ...base, startsAt: '2026-07-01T00:00:00.000Z' }, now),
    'scheduled',
  );
  assert.equal(announcementState({ ...base, endsAt: '2026-05-20T00:00:00.000Z' }, now), 'ended');
  assert.equal(announcementState({ ...base, active: false }, now), 'off');

  const diff = diffEntries(
    { status: 'active', weights: { a: 30, b: 10 }, gone: true },
    { status: 'suspended', weights: { a: 30, b: 20 }, added: 'x' },
  );
  const byKey = Object.fromEntries(diff.map((d) => [d.key, d.kind]));
  assert.deepEqual(byKey, {
    status: 'changed',
    'weights.b': 'changed',
    gone: 'removed',
    added: 'added',
    'weights.a': 'same',
  });
  assert.equal(diff[0].kind, 'changed', 'changes come first');
  assert.deepEqual(diffEntries(undefined, { x: 1 }), [{ key: 'x', kind: 'added', after: '1' }]);

  assert.deepEqual(pageWindow(1, 1), [1]);
  assert.deepEqual(pageWindow(5, 10), [1, 'gap', 4, 5, 6, 'gap', 10]);
  assert.deepEqual(pageWindow(2, 3), [1, 2, 3]);
});
