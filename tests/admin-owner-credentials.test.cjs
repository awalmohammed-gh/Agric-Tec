/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Run: node --test tests/admin-owner-credentials.test.cjs
// The owner's super admin sign-in from .env: next.config.ts passes only the email and a SHA-256
// hash (never the password); the seed uses them, and older installs are updated once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');

// What next.config.ts produces from admin_email / admin_password in .env.
const OWNER_EMAIL = 'owner@example.com';
const OWNER_PASSWORD = 'Owner#Pass2026';
process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL = OWNER_EMAIL;
process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD_HASH = crypto
  .createHash('sha256')
  .update(OWNER_PASSWORD)
  .digest('hex');

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

const { readAdmins, writeAdmins } = require('../lib/admin/admin-session.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL, SUPER_ADMIN_ID } = require('../lib/admin/seed.ts');
const { CONFIGURED_SUPER_ADMIN } = require('../lib/admin/super-admin.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { hashPassword } = require('../services/auth.service.ts');

test('the build passes the email and a hash, never the password', () => {
  assert.equal(CONFIGURED_SUPER_ADMIN.email, OWNER_EMAIL);
  assert.match(CONFIGURED_SUPER_ADMIN.passwordHash, /^[0-9a-f]{64}$/);
  const source = fs.readFileSync(path.join(root, 'lib/admin/super-admin.ts'), 'utf8');
  assert.ok(
    !/process\.env\.(admin_password|ADMIN_PASSWORD)/.test(source),
    'the browser module never reads the password',
  );
});

test('a fresh install: the owner signs in with the .env credentials, no forced change', async () => {
  await assert.rejects(
    () => adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin),
    /Incorrect email or password/,
    'the demo super admin sign-in no longer works',
  );
  const session = await adminAuthService.signIn(OWNER_EMAIL, OWNER_PASSWORD);
  assert.equal(session.admin.role, 'super_admin');
  assert.equal(session.admin.email, OWNER_EMAIL);
  assert.equal(session.admin.mustChangePassword, false);
  assert.ok(![...local.map.values()].some((v) => v.includes(OWNER_PASSWORD)), 'never stored');
  // The rest of the team is unchanged.
  await adminAuthService.signOut();
  const efua = await adminAuthService.signIn('efua.asantewaa@agrictec.app', DEMO_PASSWORDS.team);
  assert.equal(efua.admin.role, 'admin');
  await adminAuthService.signOut();
});

test('an older install is updated once; a password changed in the console then stays', async () => {
  // Simulate an install made before .env had credentials.
  writeAdmins(
    readAdmins().map((a) =>
      a.id === SUPER_ADMIN_ID
        ? {
            ...a,
            email: SUPER_ADMIN_EMAIL,
            passwordHash: '0'.repeat(64),
            mustChangePassword: true,
            configuredFrom: undefined,
          }
        : a,
    ),
  );
  await adminAuthService.signIn(OWNER_EMAIL, OWNER_PASSWORD);
  const owner = readAdmins().find((a) => a.id === SUPER_ADMIN_ID);
  assert.equal(owner.email, OWNER_EMAIL);
  assert.equal(owner.mustChangePassword, false);
  assert.ok(
    readAuditLog().some((e) => e.action === 'admin.credentials_configured'),
    'the update is audited',
  );

  // The owner changes the password in the console: the next sign-in keeps it.
  await adminAuthService.changePassword(OWNER_PASSWORD, 'Brand#New2026x');
  await adminAuthService.signOut();
  await adminAuthService.signIn(OWNER_EMAIL, 'Brand#New2026x');
  assert.equal(
    readAdmins().find((a) => a.id === SUPER_ADMIN_ID).passwordHash,
    await hashPassword('Brand#New2026x'),
  );
  await assert.rejects(
    () =>
      adminAuthService.signOut().then(() => adminAuthService.signIn(OWNER_EMAIL, OWNER_PASSWORD)),
    /Incorrect email or password/,
  );
});
