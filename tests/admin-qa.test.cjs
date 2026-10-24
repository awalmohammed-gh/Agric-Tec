/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS hooks load the app's TypeScript without an extra test dependency. */
// Phase A15 QA: every admin action as every role, audit coverage, export safety, edge cases.
// Run: node --test --test-isolation=none tests/admin-qa.test.cjs
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
// An EventTarget, so the cross-tab `storage` subscription can be exercised too.
globalThis.window = Object.assign(new EventTarget(), {
  localStorage: new MemoryStorage(),
  sessionStorage: new MemoryStorage(),
  atob: globalThis.atob,
  btoa: globalThis.btoa,
});
globalThis.document = { cookie: '' };
const local = globalThis.window.localStorage;

const { can, ROLE_PERMISSIONS, PermissionError } = require('../lib/admin/permissions.ts');
const { readAuditLog } = require('../lib/admin/audit.ts');
const { readAdmins } = require('../lib/admin/admin-session.ts');
const { PLATFORM_KEYS } = require('../lib/admin/keys.ts');
const { readUsers } = require('../lib/admin/farmer-data.ts');
const { DEMO_PASSWORDS, SUPER_ADMIN_EMAIL } = require('../lib/admin/seed.ts');
const { configValues, impactOf, impactInChunks } = require('../lib/admin/credit-rules.ts');
const { DELETED_FARMER_LABEL, nextStatuses } = require('../lib/admin/loan-status.ts');
const { REJECT_REASONS } = require('../lib/admin/verification-queue.ts');
const { kpis } = require('../lib/admin/analytics.ts');
const { mapInChunks } = require('../lib/chunked.ts');
const { startImpersonation } = require('../lib/admin/impersonation.ts');
const { storage } = require('../services/storage.ts');
const { authService } = require('../services/auth.service.ts');
const { adminAuthService } = require('../services/admin/admin-auth.service.ts');
const { farmersService } = require('../services/admin/farmers.service.ts');
const { verificationsService } = require('../services/admin/verifications.service.ts');
const { loanApplicationsService } = require('../services/admin/loan-applications.service.ts');
const { lendersService } = require('../services/admin/lenders.service.ts');
const { configService } = require('../services/admin/config.service.ts');
const { contentService } = require('../services/admin/content.service.ts');
const { announcementsService } = require('../services/admin/announcements.service.ts');
const { riskService } = require('../services/admin/risk.service.ts');
const { teamService } = require('../services/admin/team.service.ts');
const { auditService } = require('../services/admin/audit.service.ts');
const { reportsService } = require('../services/admin/reports.service.ts');
const {
  backupService,
  DELETE_FARMERS_CONFIRMATION,
  IMPORT_CONFIRMATION,
  RESET_CONFIRMATION,
} = require('../services/admin/backup.service.ts');

const NEW_SUPER_PASSWORD = 'Harvest#2026';

// The spec Section 2 table, typed out again here (not read from ROLE_PERMISSIONS), so this file
// checks the code against the spec rather than against itself.
const SPEC = {
  'overview.view': ['analyst', 'support', 'admin', 'super_admin'],
  'farmers.view': ['analyst', 'support', 'admin', 'super_admin'],
  'farmers.edit': ['support', 'admin', 'super_admin'],
  'farmers.suspend': ['admin', 'super_admin'],
  'farmers.delete': ['super_admin'],
  'farmers.impersonate': ['support', 'admin', 'super_admin'],
  'verifications.review': ['support', 'admin', 'super_admin'],
  'loans.view': ['analyst', 'support', 'admin', 'super_admin'],
  'loans.manage': ['admin', 'super_admin'],
  'lenders.manage': ['admin', 'super_admin'],
  'credit.configure': ['super_admin'],
  'content.manage': ['admin', 'super_admin'],
  'announcements.send': ['admin', 'super_admin'],
  'risk.review': ['support', 'admin', 'super_admin'],
  'reports.export': ['analyst', 'admin', 'super_admin'],
  'admins.manage': ['super_admin'],
  'audit.view': ['admin', 'super_admin'],
  'settings.manage': ['super_admin'],
  'data.manage': ['super_admin'],
};

const ROLES = [
  { role: 'analyst', email: 'yaw.darko@agrictec.app', password: DEMO_PASSWORDS.team },
  { role: 'support', email: 'kofi.adjei@agrictec.app', password: DEMO_PASSWORDS.team },
  { role: 'admin', email: 'efua.asantewaa@agrictec.app', password: DEMO_PASSWORDS.team },
  { role: 'super_admin', email: SUPER_ADMIN_EMAIL, password: NEW_SUPER_PASSWORD },
];

async function signInAs({ email, password }) {
  await adminAuthService.signOut();
  return adminAuthService.signIn(email, password);
}

/** Every app key except the admin's own session, which signing in rewrites. */
function snapshot() {
  return JSON.stringify(
    [...local.map.entries()]
      .filter(([key]) => key !== 'agrictec:admin-session')
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

// ---------- Fixtures (read straight from storage, so a denied role can still be pointed at
// something real and reach the permission check) ----------

const used = new Set();
const fresh = (items, id = (item) => item.id) => {
  const item = items.find((candidate) => !used.has(id(candidate)));
  assert.ok(item, 'a fixture is left for this check');
  used.add(id(item));
  return item;
};
const farmers = () => readUsers().filter((u) => !u.isGuest);
const activeFarmer = () => fresh(farmers().filter((u) => (u.status ?? 'active') === 'active'));
// Its own key: a farmer suspended earlier in the run is a fine target for reactivating.
const suspendedFarmer = () =>
  fresh(
    farmers().filter((u) => u.status === 'suspended'),
    (u) => `reactivate:${u.id}`,
  );
const anyFarmer = () => farmers()[0];
const list = (key) => storage.get(key, []);
const pending = (card) =>
  list(PLATFORM_KEYS.verifications).filter(
    (v) => v.status === 'pending' && (card === undefined || (v.kind === 'ghanaCard') === card),
  );
const existingFarmer = (app) => readUsers().some((u) => u.id === app.userId);
const lenders = () => list(PLATFORM_KEYS.lenders);
const openFlags = () => list(PLATFORM_KEYS.riskFlags).filter((f) => f.status === 'open');
const nonSuperAdmins = () => readAdmins().filter((a) => a.role !== 'super_admin');
/** Whatever each role created (lender, announcement, invite), for the follow-up checks. */
const created = {};

/** Every export's text, for the data-safety scan. */
const exportsSeen = [];
const keep = (label, content) => {
  exportsSeen.push({
    label,
    content: typeof content === 'string' ? content : JSON.stringify(content),
  });
  return content;
};
const blobText = async (value) => (typeof value === 'string' ? value : value.text());

/**
 * Every write the console can make. `audit` is the action recorded; `before` says whether a
 * "before" is expected (creates, exports and scans have nothing before them).
 */
const WRITES = [
  // Farmers
  {
    label: 'Edit farmer profile',
    permission: 'farmers.edit',
    audit: 'farmer.update',
    before: true,
    run: (role) => farmersService.updateProfile(activeFarmer().id, { farmName: `QA Farm ${role}` }),
  },
  {
    label: 'Add admin note',
    permission: 'farmers.edit',
    audit: 'farmer.note',
    before: false,
    run: () => farmersService.addNote(anyFarmer().id, 'QA: checked by phone'),
  },
  {
    label: 'Set farmer tags',
    permission: 'farmers.edit',
    audit: 'farmer.tags',
    before: true,
    run: (role) => farmersService.setTags(anyFarmer().id, [`qa-${role}`]),
  },
  {
    label: 'Reset farmer password',
    permission: 'farmers.edit',
    audit: 'farmer.reset_password',
    before: false,
    run: () => farmersService.resetPassword(activeFarmer().id),
  },
  {
    label: 'Suspend farmer',
    permission: 'farmers.suspend',
    audit: 'farmer.suspend',
    before: true,
    run: () => farmersService.suspend(activeFarmer().id, 'QA: suspicious receipts'),
  },
  {
    label: 'Reactivate farmer',
    permission: 'farmers.suspend',
    audit: 'farmer.reactivate',
    before: true,
    run: () => farmersService.reactivate(suspendedFarmer().id),
  },
  {
    label: 'Delete farmer permanently',
    permission: 'farmers.delete',
    audit: 'farmer.delete',
    before: true,
    run: () => {
      const user = activeFarmer();
      return farmersService.remove(user.id, user.email);
    },
  },
  {
    label: 'View as farmer (read-only)',
    permission: 'farmers.impersonate',
    audit: 'farmer.impersonate',
    before: false,
    run: () => startImpersonation(anyFarmer().id),
  },
  {
    label: 'Export farmers CSV',
    permission: 'reports.export',
    audit: 'farmer.export',
    before: false,
    run: async () => keep('farmers CSV', await farmersService.exportCSV()),
  },
  {
    label: 'Export a farmer’s records CSV',
    permission: 'reports.export',
    audit: 'farmer.export_records',
    before: false,
    run: async () =>
      keep('farmer records CSV', await farmersService.exportRecordsCSV(anyFarmer().id)),
  },
  // Verifications
  {
    label: 'Approve verification',
    permission: 'verifications.review',
    audit: 'verification.approve',
    before: true,
    run: () => verificationsService.approve(fresh(pending(true)).id),
  },
  {
    label: 'Reject verification',
    permission: 'verifications.review',
    audit: 'verification.reject',
    before: true,
    run: () => verificationsService.reject(fresh(pending(true)).id, REJECT_REASONS[0], 'QA'),
  },
  {
    label: 'Bulk approve (1 item → 1 entry)',
    permission: 'verifications.review',
    audit: 'verification.approve',
    before: true,
    run: () => verificationsService.approveMany([fresh(pending(false)).id]),
  },
  // Loans
  {
    label: 'Move loan application',
    permission: 'loans.manage',
    audit: 'loan.status',
    before: true,
    run: () =>
      loanApplicationsService.updateStatus(
        fresh(
          list(PLATFORM_KEYS.loanApplications).filter(
            (a) => a.status === 'submitted' && existingFarmer(a),
          ),
        ).id,
        'under_review',
      ),
  },
  {
    label: 'Export applications CSV',
    permission: 'reports.export',
    audit: 'loan.export',
    before: false,
    run: async () => keep('applications CSV', await loanApplicationsService.exportCSV()),
  },
  // Lenders
  {
    label: 'Add lender',
    permission: 'lenders.manage',
    audit: 'lender.create',
    before: false,
    run: async (role) => {
      const input = Object.fromEntries(
        Object.entries(lenders()[0]).filter(([field]) => field !== 'id' && field !== 'createdAt'),
      );
      created[`lender-${role}`] = await lendersService.create({
        ...input,
        name: `QA Lender ${role}`,
      });
      return created[`lender-${role}`];
    },
  },
  {
    label: 'Edit lender',
    permission: 'lenders.manage',
    audit: 'lender.update',
    before: true,
    run: (role) => lendersService.update(lenders()[0].id, { description: `Checked by ${role}` }),
  },
  {
    label: 'Deactivate / activate lender',
    permission: 'lenders.manage',
    audit: 'lender.deactivate',
    before: true,
    run: (role) => lendersService.toggleActive((created[`lender-${role}`] ?? lenders()[0]).id),
  },
  {
    label: 'Delete lender',
    permission: 'lenders.manage',
    audit: 'lender.delete',
    before: true,
    run: (role) => lendersService.remove((created[`lender-${role}`] ?? lenders()[0]).id),
  },
  // Credit rules
  {
    label: 'Publish credit rules',
    permission: 'credit.configure',
    audit: 'credit.publish',
    before: true,
    run: async () => {
      const live = configValues(await readCredit());
      const minScore = live.eligibility.minScore === 550 ? 560 : 550;
      return configService.publishCreditConfig(
        { ...live, eligibility: { ...live.eligibility, minScore } },
        'QA: stricter minimum score',
      );
    },
  },
  {
    label: 'Save credit rules',
    permission: 'credit.configure',
    audit: 'credit.update',
    before: true,
    run: async () => configService.saveCreditConfig(configValues(await readCredit())),
  },
  {
    label: 'Restore credit version',
    permission: 'credit.configure',
    audit: 'credit.restore',
    before: true,
    run: async () => configService.restoreCreditVersion(1, 'QA: back to the defaults'),
  },
  // Content
  {
    label: 'Save market prices',
    permission: 'content.manage',
    audit: 'content.market',
    before: true,
    run: async () => contentService.saveMarketPrices(await contentService.getMarketPrices()),
  },
  {
    label: 'Weather override',
    permission: 'content.manage',
    audit: 'content.weather',
    before: true,
    run: () => contentService.saveWeatherOverride(null),
  },
  {
    label: 'Save crops & yields',
    permission: 'content.manage',
    audit: 'content.crops',
    before: true,
    run: async () => contentService.saveCrops(await contentService.getCrops()),
  },
  {
    label: 'Save AI assistant knowledge',
    permission: 'content.manage',
    audit: 'content.assistant',
    before: true,
    run: async () => contentService.saveAssistantKb(await contentService.getAssistantKb()),
  },
  {
    label: 'Save crop diagnoses',
    permission: 'content.manage',
    audit: 'content.diagnoses',
    before: true,
    run: async () => contentService.saveDiagnoses(await contentService.getDiagnoses()),
  },
  // Announcements
  {
    label: 'Create announcement',
    permission: 'announcements.send',
    audit: 'announcement.create',
    before: false,
    run: async (role) => {
      created[`announcement-${role}`] = await announcementsService.create({
        title: `QA notice ${role}`,
        message: 'Checking that announcements reach farmers.',
        type: 'info',
        audience: { kind: 'all' },
        // Scheduled for tomorrow: only scheduled announcements can still be edited.
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        active: true,
        dismissible: true,
      });
      return created[`announcement-${role}`];
    },
  },
  {
    label: 'Edit announcement',
    permission: 'announcements.send',
    audit: 'announcement.update',
    before: true,
    run: (role) =>
      announcementsService.update(
        (created[`announcement-${role}`] ?? list(PLATFORM_KEYS.announcements)[0]).id,
        {
          title: `QA notice (edited by ${role})`,
        },
      ),
  },
  {
    label: 'End announcement',
    permission: 'announcements.send',
    audit: 'announcement.end',
    before: true,
    run: (role) =>
      announcementsService.end(
        (created[`announcement-${role}`] ?? list(PLATFORM_KEYS.announcements)[0]).id,
      ),
  },
  {
    label: 'Delete announcement',
    permission: 'announcements.send',
    audit: 'announcement.delete',
    before: true,
    run: (role) =>
      announcementsService.remove(
        (created[`announcement-${role}`] ?? list(PLATFORM_KEYS.announcements)[0]).id,
      ),
  },
  // Risk
  {
    label: 'Run risk scan',
    permission: 'risk.review',
    audit: 'risk.scan',
    before: false,
    run: () => riskService.runScan(),
  },
  {
    label: 'Dismiss risk flag',
    permission: 'risk.review',
    audit: 'risk.dismiss',
    before: true,
    run: () => riskService.dismiss(fresh(openFlags()).id, 'QA: explained by the farmer'),
  },
  {
    label: 'Confirm risk flag',
    permission: 'risk.review',
    audit: 'risk.confirm',
    before: true,
    run: () => riskService.confirm(fresh(openFlags()).id, 'QA: receipts do not match'),
  },
  // Reports
  {
    label: 'Export report (CSV)',
    permission: 'reports.export',
    audit: 'report.export',
    before: false,
    run: async () => {
      const file = await reportsService.exportReport('platform', 'csv');
      keep('platform report CSV', await blobText(file.content));
      return file;
    },
  },
  {
    label: 'Export report (PDF)',
    permission: 'reports.export',
    audit: 'report.export',
    before: false,
    run: async () => {
      const file = await reportsService.exportReport('loans', 'pdf');
      keep('loans report PDF', await blobText(file.content));
      return file;
    },
  },
  {
    label: 'Custom report export',
    permission: 'reports.export',
    audit: 'report.export',
    before: false,
    run: async () => {
      const file = await reportsService.exportCustom({
        dataset: 'farmers',
        columns: ['name', 'email', 'phone', 'region', 'ghanaCard'],
      });
      keep('custom farmers CSV', file.csv);
      return file;
    },
  },
  // Team
  {
    label: 'Invite team member',
    permission: 'admins.manage',
    audit: 'admin.invite',
    before: false,
    run: async (role) => {
      created[`invite-${role}`] = await teamService.invite(
        'QA Invitee',
        `qa.${role}@agrictec.app`,
        'analyst',
      );
      return created[`invite-${role}`];
    },
  },
  {
    label: 'Change role',
    permission: 'admins.manage',
    audit: 'admin.role',
    before: true,
    run: (role) =>
      teamService.changeRole(
        (created[`invite-${role}`]?.admin ?? nonSuperAdmins()[0]).id,
        'support',
      ),
  },
  {
    label: 'Disable member',
    permission: 'admins.manage',
    audit: 'admin.disable',
    before: true,
    run: (role) =>
      teamService.disable((created[`invite-${role}`]?.admin ?? nonSuperAdmins()[0]).id),
  },
  {
    label: 'Enable member',
    permission: 'admins.manage',
    audit: 'admin.enable',
    before: true,
    run: (role) => teamService.enable((created[`invite-${role}`]?.admin ?? nonSuperAdmins()[0]).id),
  },
  {
    label: 'Reset member password',
    permission: 'admins.manage',
    audit: 'admin.reset_password',
    before: false,
    run: (role) =>
      teamService.resetPassword((created[`invite-${role}`]?.admin ?? nonSuperAdmins()[0]).id),
  },
  // Audit log
  {
    label: 'Export audit log (CSV)',
    permission: 'audit.view',
    audit: 'audit.export',
    before: false,
    run: async () => keep('audit CSV', await auditService.exportFiltered({}, 'csv')),
  },
  {
    label: 'Export audit log (JSON)',
    permission: 'audit.view',
    audit: 'audit.export',
    before: false,
    run: async () => keep('audit JSON', await auditService.exportJSON()),
  },
  // System settings
  {
    label: 'Feature flags',
    permission: 'settings.manage',
    audit: 'settings.flags',
    before: true,
    run: async () => configService.saveFlags(await configService.getFlags()),
  },
  {
    label: 'Plans',
    permission: 'settings.manage',
    audit: 'settings.plans',
    before: true,
    run: async () => configService.savePlans(await configService.getPlans()),
  },
  {
    label: 'Download backup',
    permission: 'data.manage',
    audit: 'system.export',
    before: false,
    run: async () => keep('platform backup JSON', await backupService.exportAll()),
  },
];

/** Pages and lists: denied roles get a PermissionError (the page shows NoAccess). */
const READS = [
  { label: 'Farmers list', permission: 'farmers.view', run: () => farmersService.list() },
  {
    label: 'Farmer detail',
    permission: 'farmers.view',
    run: () => farmersService.getDetail(anyFarmer().id),
  },
  {
    label: 'Verifications queue',
    permission: 'verifications.review',
    run: () => verificationsService.list(),
  },
  {
    label: 'Loan applications',
    permission: 'loans.view',
    run: () => loanApplicationsService.list(),
  },
  { label: 'Risk flags', permission: 'risk.review', run: () => riskService.list() },
  {
    label: 'Risk evidence',
    permission: 'risk.review',
    run: () => riskService.getRelated(list(PLATFORM_KEYS.riskFlags)[0].id),
  },
  {
    label: 'Credit rules history',
    permission: 'credit.configure',
    run: () => configService.getCreditHistory(),
  },
  {
    label: 'Credit impact inputs',
    permission: 'credit.configure',
    run: () => configService.getScoringInputs(),
  },
  {
    label: 'Announcements',
    permission: 'announcements.send',
    run: () => announcementsService.list(),
  },
  { label: 'Reports data', permission: 'reports.export', run: () => reportsService.load() },
  {
    label: 'Report preview',
    permission: 'reports.export',
    run: () => reportsService.build('regions'),
  },
  { label: 'Team list', permission: 'admins.manage', run: () => teamService.list() },
  { label: 'Audit log', permission: 'audit.view', run: () => auditService.list() },
];

async function readCredit() {
  return configService.getCreditConfig();
}

/** Actions with two forms: switching a lender off or on, setting or clearing the weather. */
const ALTERNATIVES = {
  'lender.deactivate': /^lender\.(de)?activate$/,
  'content.weather': /^content\.weather(_clear)?$/,
};

const results = new Map(); // label -> { permission, role -> '✅' | '—' }
const mark = (label, permission, role, ok) => {
  if (!results.has(label)) results.set(label, { permission });
  results.get(label)[role] = ok ? '✅' : '—';
};

test('setup: the super admin signs in, changes the temporary password, the demo world seeds', async () => {
  await adminAuthService.signIn(SUPER_ADMIN_EMAIL, DEMO_PASSWORDS.superAdmin);
  await adminAuthService.changePassword(DEMO_PASSWORDS.superAdmin, NEW_SUPER_PASSWORD);
  assert.equal((await farmersService.list()).length, 60);
});

test('the permission code matches the spec table exactly', () => {
  for (const [permission, roles] of Object.entries(SPEC)) {
    for (const { role } of ROLES) {
      assert.equal(can(role, permission), roles.includes(role), `${role} / ${permission}`);
    }
  }
  const granted = Object.values(ROLE_PERMISSIONS).flat();
  assert.ok(
    granted.every((p) => p in SPEC),
    'no permission outside the spec',
  );
});

for (const account of ROLES) {
  test(`${account.role}: every action is allowed or refused exactly as the spec says`, async () => {
    await signInAs(account);
    for (const read of READS) {
      const allowed = SPEC[read.permission].includes(account.role);
      const audit = readAuditLog().length;
      if (allowed) await read.run();
      else
        await assert.rejects(read.run, PermissionError, `${account.role} must not: ${read.label}`);
      assert.equal(
        readAuditLog().length,
        audit,
        `reading never writes the audit log (${read.label})`,
      );
      mark(read.label, read.permission, account.role, allowed);
    }
    for (const write of WRITES) {
      const allowed = SPEC[write.permission].includes(account.role);
      const audit = readAuditLog().length;
      const state = snapshot();
      if (!allowed) {
        await assert.rejects(
          () => write.run(account.role),
          PermissionError,
          `${account.role} must not: ${write.label}`,
        );
        assert.equal(snapshot(), state, `a refused "${write.label}" changes nothing`);
        assert.equal(readAuditLog().length, audit, `a refused "${write.label}" is not logged`);
      } else {
        await write.run(account.role);
        const added = readAuditLog().slice(audit);
        assert.equal(
          added.length,
          1,
          `"${write.label}" adds exactly one audit entry (got ${added.length})`,
        );
        const [entry] = added;
        const expected = ALTERNATIVES[write.audit] ?? write.audit;
        if (expected instanceof RegExp) assert.match(entry.action, expected);
        else assert.equal(entry.action, expected, write.label);
        assert.equal(entry.actorRole, account.role);
        assert.ok(entry.summary.length > 0, `${write.label} has a summary`);
        assert.notEqual(entry.after, undefined, `${write.label} records "after"`);
        if (write.before)
          assert.notEqual(entry.before, undefined, `${write.label} records "before"`);
      }
      mark(write.label, write.permission, account.role, allowed);
    }
  });
}

test('the permission table (printed) matches spec Section 2', () => {
  const header = '| Page / action | permission | analyst | support | admin | super_admin |';
  const rows = [...results.entries()].map(
    ([label, row]) =>
      `| ${label} | ${row.permission} | ${ROLES.map(({ role }) => row[role]).join(' | ')} |`,
  );
  console.log(['', header, '|---|---|:-:|:-:|:-:|:-:|', ...rows].join('\n'));
  for (const [label, row] of results) {
    for (const { role } of ROLES) {
      assert.equal(row[role] === '✅', SPEC[row.permission].includes(role), `${label} / ${role}`);
    }
  }
  assert.equal(results.size, READS.length + WRITES.length);
});

test('confirming fraud with "suspend" logs both changes, and needs farmers.suspend', async () => {
  // Support may confirm a flag but not suspend: nothing at all changes.
  await signInAs(ROLES[1]);
  const flag = fresh(openFlags());
  const state = snapshot();
  await assert.rejects(
    () => riskService.confirm(flag.id, 'QA', { suspend: true }),
    PermissionError,
  );
  assert.equal(snapshot(), state);

  await signInAs(ROLES[2]);
  const audit = readAuditLog().length;
  await riskService.confirm(flag.id, 'QA: confirmed fraud', { suspend: true });
  const actions = readAuditLog()
    .slice(audit)
    .map((e) => e.action);
  // Two state changes (the flag, the account), so two entries: one each.
  assert.deepEqual(actions.sort(), ['farmer.suspend', 'risk.confirm']);
});

test('edge case: a lender with an application under review cannot be deactivated', async () => {
  await signInAs(ROLES[3]);
  const reviewing = list(PLATFORM_KEYS.loanApplications).find((a) => a.status === 'under_review');
  const lender = lenders().find((l) => l.id === reviewing.partnerId && l.active);
  assert.ok(lender, 'an active lender with an application under review');
  const audit = readAuditLog().length;
  await assert.rejects(() => lendersService.toggleActive(lender.id), /under review/);
  assert.equal(readAuditLog().length, audit, 'a blocked change is not logged');
  assert.equal(lenders().find((l) => l.id === lender.id).active, true);
});

test('edge case: a farmer deleted while their application is open', async () => {
  await signInAs(ROLES[3]);
  const app = list(PLATFORM_KEYS.loanApplications).find(
    (a) => ['submitted', 'under_review'].includes(a.status) && existingFarmer(a),
  );
  const user = readUsers().find((u) => u.id === app.userId);
  await farmersService.remove(user.id, user.email);

  // The application stays on record, its farmer marked deleted.
  const still = await loanApplicationsService.get(app.id);
  assert.equal(still.status, app.status);
  assert.equal(await loanApplicationsService.farmerExists(app.userId), false);
  assert.equal(DELETED_FARMER_LABEL, 'Farmer deleted');
  // It can only be closed: never approved or paid out.
  assert.ok(nextStatuses(app.status, true).every((s) => s === 'rejected'));
  if (app.status === 'submitted') {
    await assert.rejects(
      () => loanApplicationsService.updateStatus(app.id, 'under_review'),
      /account was deleted/,
    );
  }
  const closed = await loanApplicationsService.updateStatus(app.id, 'rejected', {
    note: 'The farmer’s account was deleted.',
  });
  assert.equal(closed.status, 'rejected');
  // Their verifications and risk flags went with the account.
  assert.equal(list(PLATFORM_KEYS.verifications).filter((v) => v.userId === user.id).length, 0);
  assert.equal(list(PLATFORM_KEYS.riskFlags).filter((f) => f.userId === user.id).length, 0);
});

test('chunked work: the impact preview and the risk scan match, with progress', async () => {
  await signInAs(ROLES[3]);
  const inputs = await configService.getScoringInputs();
  const live = configValues(await configService.getCreditConfig());
  const draft = { ...live, eligibility: { ...live.eligibility, minRecords: 9 } };
  const steps = [];
  const chunked = await impactInChunks(inputs, live, draft, {
    onProgress: (done, total) => steps.push([done, total]),
  });
  assert.deepEqual(chunked, impactOf(inputs, live, draft));
  assert.ok(steps.length > 1, 'progress is reported more than once');
  assert.deepEqual(steps.at(-1), [inputs.length, inputs.length]);

  const controller = new AbortController();
  const pendingRun = mapInChunks([1, 2, 3], (n) => n * 2, { size: 1, signal: controller.signal });
  controller.abort();
  await assert.rejects(pendingRun, { name: 'AbortError' });

  const phases = [];
  await riskService.runScan((p) => phases.push(p.phase));
  assert.deepEqual([...new Set(phases)], ['reading', 'checking', 'comparing']);
});

test('cross-tab: another tab’s write reaches subscribers, without the prefix', () => {
  const seen = [];
  const stop = storage.onExternalChange((key) => seen.push(key));
  const fire = (key, area = local) =>
    window.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea: area }));
  fire('agrictec:platform:flags');
  fire('agrictec:seed-farmer-1:records');
  fire('other-app:key'); // not ours
  fire('agrictec:x', window.sessionStorage); // per-tab storage
  fire(null); // storage cleared
  stop();
  fire('agrictec:platform:lenders'); // after unsubscribing
  assert.deepEqual(seen, ['platform:flags', 'seed-farmer-1:records', null]);
});

test('data safety: no export carries a password hash or a full Ghana Card number', async () => {
  await signInAs(ROLES[3]);
  const hashes = [
    ...readUsers().map((u) => u.passwordHash),
    ...readAdmins().map((a) => a.passwordHash),
  ].filter(Boolean);
  assert.ok(exportsSeen.length >= 10, `scanned ${exportsSeen.length} exports`);
  for (const { label, content } of exportsSeen) {
    assert.ok(!/passwordHash/i.test(content), `${label}: no passwordHash field`);
    for (const hash of hashes) assert.ok(!content.includes(hash), `${label}: no password hash`);
    assert.ok(!/GHA-\d{9}-\d/.test(content), `${label}: no full Ghana Card number`);
  }
  // Nothing in storage holds a full card number either: only the mask and the hash.
  assert.ok(![...local.map.values()].some((v) => /GHA-\d{9}-\d/.test(v)));
});

test('a backup restores without carrying passwords: accounts keep their current ones', async () => {
  await signInAs(ROLES[3]);
  const backup = await backupService.exportAll();
  assert.ok(!backup.includes('passwordHash'));
  const seeded = readUsers().find(
    (u) => u.id.startsWith('seed-farmer-') && u.status !== 'suspended',
  );
  await backupService.resetDemo(RESET_CONFIRMATION);
  const audit = readAuditLog().length;
  await backupService.importAll(backup, IMPORT_CONFIRMATION);
  const [entry] = readAuditLog().slice(audit);
  assert.equal(entry.action, 'system.import');
  assert.ok(entry.before.farmers > 0 && entry.after.farmers > 0, 'counts before and after');
  // The farmer can still sign in with their password after the restore.
  const session = await authService.signIn(seeded.email, DEMO_PASSWORDS.farmer);
  assert.equal(session.userId, seeded.id);
  await authService.signOut();
});

test('edge case: an empty platform (every farmer deleted) still loads every admin page', async () => {
  await signInAs(ROLES[3]);
  const audit = readAuditLog().length;
  await backupService.deleteAllFarmers(DELETE_FARMERS_CONFIRMATION, NEW_SUPER_PASSWORD);
  const [entry] = readAuditLog().slice(audit);
  assert.equal(entry.action, 'system.delete_farmers');
  assert.equal(entry.after.farmers, 0);
  assert.ok(entry.before.farmers > 0);

  const [farmerList, verifications, apps, flags] = await Promise.all([
    farmersService.list(),
    verificationsService.list(),
    loanApplicationsService.list(),
    riskService.list(),
  ]);
  assert.deepEqual(
    [farmerList, verifications, apps, flags].map((l) => l.length),
    [0, 0, 0, 0],
  );
  const summary = kpis(farmerList, apps, flags, verifications);
  assert.equal(summary.totalFarmers, 0);
  assert.ok(Number.isFinite(summary.averageScore));
  for (const id of ['platform', 'regions', 'loans', 'credit', 'verifications', 'risk']) {
    const report = await reportsService.build(id);
    assert.ok(report.title, `${id} report builds on an empty platform`);
  }
  assert.deepEqual(await riskService.runScan(), []);
  const inputs = await configService.getScoringInputs();
  const live = configValues(await configService.getCreditConfig());
  assert.equal(impactOf(inputs, live, live).averageDraft, 0);
});
