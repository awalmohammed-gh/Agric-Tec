import { z } from 'zod';
import { withAudit } from '@/lib/admin/audit';
import { ADMIN_LOCKOUT_KEY, ADMIN_SESSION_KEY, PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  announcementInputSchema,
  assistantKbSchema,
  creditConfigSchema,
  cropContentSchema,
  diagnosesContentSchema,
  featureFlagsSchema,
  firstIssue,
  lenderSchema,
  marketPricesSchema,
  plansSchema,
  weatherSchema,
} from '@/lib/admin/schemas';
import { getCurrentAdmin, readAdmins } from '@/lib/admin/admin-session';
import { readUsers, writeUsers } from '@/lib/admin/farmer-data';
import { hashPassword } from '@/services/auth.service';
import { clearSeedData, seedPlatform } from '@/lib/admin/seed';
import { delay, storage } from '@/services/storage';

/** Never exported or overwritten: sign-ins belong to this browser, and the audit trail and team are append-only / managed in Team & Roles. */
const PROTECTED = new Set<string>([
  ADMIN_SESSION_KEY,
  ADMIN_LOCKOUT_KEY,
  'session',
  PLATFORM_KEYS.admins,
  PLATFORM_KEYS.audit,
  PLATFORM_KEYS.auditArchive,
]);

/** Typed by the admin before a restore replaces everything. */
export const IMPORT_CONFIRMATION = 'RESTORE';
export const RESET_CONFIRMATION = 'RESET';
export const DELETE_FARMERS_CONFIRMATION = 'DELETE ALL FARMERS';

/** What a backup holds, for the summary shown before restoring ("60 farmers, 25 applications…"). */
export interface BackupSummary {
  exportedAt: string;
  keys: number;
  farmers: number;
  records: number;
  momo: number;
  applications: number;
  verifications: number;
  riskFlags: number;
  lenders: number;
  announcements: number;
}

export function summarizeBackup(backup: PlatformBackup): BackupSummary {
  const list = (key: string) => {
    const value = backup.data[key];
    return Array.isArray(value) ? value : [];
  };
  const users = list('users') as { id?: unknown; isGuest?: unknown }[];
  const perUser = (name: string) =>
    Object.entries(backup.data)
      .filter(([key, value]) => key.endsWith(`:${name}`) && Array.isArray(value))
      .reduce((total, [, value]) => total + (value as unknown[]).length, 0);
  return {
    exportedAt: backup.exportedAt,
    keys: Object.keys(backup.data).filter((key) => !PROTECTED.has(key)).length,
    farmers: users.filter((u) => u.isGuest !== true).length,
    records: perUser('records'),
    momo: perUser('momo'),
    applications: list(PLATFORM_KEYS.loanApplications).length,
    verifications: list(PLATFORM_KEYS.verifications).length,
    riskFlags: list(PLATFORM_KEYS.riskFlags).length,
    lenders: list(PLATFORM_KEYS.lenders).length,
    announcements: list(PLATFORM_KEYS.announcements).length,
  };
}

const withId = z.looseObject({ id: z.string().min(1), userId: z.string().min(1) });

/** Platform keys get a full check; other keys (per-farmer data) only need to be JSON. */
const KEY_SCHEMAS: Partial<Record<string, z.ZodType>> = {
  [PLATFORM_KEYS.creditConfig]: creditConfigSchema,
  [PLATFORM_KEYS.creditHistory]: z.array(creditConfigSchema),
  [PLATFORM_KEYS.flags]: featureFlagsSchema,
  [PLATFORM_KEYS.plans]: plansSchema,
  [PLATFORM_KEYS.lenders]: z.array(lenderSchema),
  [PLATFORM_KEYS.market]: marketPricesSchema,
  [PLATFORM_KEYS.weatherOverride]: weatherSchema.nullable(),
  [PLATFORM_KEYS.crops]: cropContentSchema,
  [PLATFORM_KEYS.assistantKb]: assistantKbSchema,
  [PLATFORM_KEYS.diagnoses]: diagnosesContentSchema,
  [PLATFORM_KEYS.announcements]: z.array(
    z.intersection(announcementInputSchema, z.looseObject({ id: z.string().min(1) })),
  ),
  [PLATFORM_KEYS.verifications]: z.array(withId),
  [PLATFORM_KEYS.loanApplications]: z.array(withId),
  [PLATFORM_KEYS.riskFlags]: z.array(withId),
  [PLATFORM_KEYS.seeded]: z.string(),
  users: z.array(
    z.looseObject({
      id: z.string().min(1),
      email: z.string(),
      // Backups made since phase A15 have no password hashes; older ones still do.
      passwordHash: z.string().optional(),
      isGuest: z.boolean(),
    }),
  ),
};

const backupFileSchema = z.object({
  app: z.literal('agrictec'),
  kind: z.literal('platform-backup'),
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  data: z.record(z.string().regex(/^[\w.:-]{1,200}$/, 'Invalid key name.'), z.unknown()),
});

export type PlatformBackup = z.infer<typeof backupFileSchema>;

/** Parses and validates a backup file's text. Throws a readable error, changing nothing. */
export function parsePlatformBackup(json: string): PlatformBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  const parsed = backupFileSchema.safeParse(raw);
  if (!parsed.success)
    throw new Error(`This is not an AgriCtec platform backup: ${firstIssue(parsed.error)}`);
  for (const [key, value] of Object.entries(parsed.data.data)) {
    const schema = KEY_SCHEMAS[key];
    const result = schema?.safeParse(value);
    if (result && !result.success)
      throw new Error(`“${key}” is invalid: ${firstIssue(result.error)}`);
  }
  return parsed.data;
}

const USERS_KEY = 'users';

/** Farmer accounts as written to a backup file: everything except the password hash. */
function withoutPasswords(users: unknown): unknown {
  if (!Array.isArray(users)) return users;
  return users.map((user: unknown) =>
    user && typeof user === 'object'
      ? Object.fromEntries(Object.entries(user).filter(([field]) => field !== 'passwordHash'))
      : user,
  );
}

/**
 * Farmer accounts as restored: each keeps the password it has on this device now. An account that
 * only exists in the backup gets none (it can't sign in) until an admin resets its password.
 */
function withCurrentPasswords(users: unknown): unknown {
  if (!Array.isArray(users)) return users;
  const current = new Map(readUsers().map((user) => [user.id, user.passwordHash]));
  return users.map((user: { id: string; passwordHash?: string }) => ({
    ...user,
    passwordHash: current.get(user.id) ?? user.passwordHash ?? '',
  }));
}

/** What the platform holds right now: the before and after of a change that replaces or wipes it. */
function platformCounts() {
  return {
    farmers: readUsers().filter((u) => !u.isGuest).length,
    applications: storage.get<unknown[]>(PLATFORM_KEYS.loanApplications, []).length,
    verifications: storage.get<unknown[]>(PLATFORM_KEYS.verifications, []).length,
    riskFlags: storage.get<unknown[]>(PLATFORM_KEYS.riskFlags, []).length,
  };
}

export const backupService = {
  /**
   * One JSON file with every app key (except sign-ins, the team and the audit trail). Password
   * hashes are left out of the farmer accounts: a backup file must never carry them.
   */
  async exportAll(): Promise<string> {
    await delay();
    const keys = storage
      .keys()
      .filter((key) => !PROTECTED.has(key))
      .sort();
    return withAudit(
      {
        permission: 'data.manage',
        action: 'system.export',
        targetType: 'system',
        summary: `Exported a platform backup (${keys.length} keys)`,
        after: () => ({ keys: keys.length }),
      },
      async () => {
        const data: Record<string, unknown> = {};
        for (const key of keys) {
          const raw = storage.getRaw(key);
          if (raw === null) continue;
          try {
            const value: unknown = JSON.parse(raw);
            data[key] = key === USERS_KEY ? withoutPasswords(value) : value;
          } catch {
            // A corrupt value is skipped rather than breaking the whole backup.
          }
        }
        const backup: PlatformBackup = {
          app: 'agrictec',
          kind: 'platform-backup',
          version: 1,
          exportedAt: new Date().toISOString(),
          data,
        };
        return JSON.stringify(backup);
      },
    );
  },

  /**
   * Replaces all platform and farmer data with the backup. The caller must pass "RESTORE" after
   * the admin confirms. Sign-ins, the team and the audit trail are never replaced; accounts keep
   * their current passwords. All or nothing.
   */
  async importAll(json: string, confirmation: string): Promise<{ keys: number }> {
    await delay();
    return withAudit(
      {
        permission: 'data.manage',
        action: 'system.import',
        targetType: 'system',
        summary: 'Imported a platform backup',
        before: platformCounts(),
        after: (result) => ({ keys: result.keys, ...platformCounts() }),
      },
      async () => {
        if (confirmation !== IMPORT_CONFIRMATION) {
          throw new Error(`Type ${IMPORT_CONFIRMATION} to confirm the import.`);
        }
        const backup = parsePlatformBackup(json);
        const data = { ...backup.data };
        if (USERS_KEY in data) data[USERS_KEY] = withCurrentPasswords(data[USERS_KEY]);
        storage.replaceKeys(data, (key) => PROTECTED.has(key));
        return { keys: Object.keys(backup.data).filter((key) => !PROTECTED.has(key)).length };
      },
    );
  },

  /**
   * Deletes every farmer account and all farmer data (records, MoMo, profiles, applications,
   * verifications, risk flags). The team, the platform settings, content and the audit log are
   * kept. Needs "DELETE ALL FARMERS" and the current super admin's password.
   */
  async deleteAllFarmers(confirmation: string, password: string): Promise<{ farmers: number }> {
    await delay();
    const admin = getCurrentAdmin();
    const stored = admin && readAdmins().find((a) => a.id === admin.id);
    return withAudit(
      {
        permission: 'data.manage',
        action: 'system.delete_farmers',
        targetType: 'system',
        summary: (result) => `Deleted all farmer data (${result.farmers} accounts)`,
        before: platformCounts(),
        after: () => platformCounts(),
      },
      async () => {
        if (confirmation !== DELETE_FARMERS_CONFIRMATION)
          throw new Error(`Type ${DELETE_FARMERS_CONFIRMATION} to confirm.`);
        if (!stored || stored.passwordHash !== (await hashPassword(password)))
          throw new Error('That password is not correct.');
        const users = readUsers();
        users.forEach((user) => storage.clearUser(user.id));
        writeUsers([]);
        storage.set(PLATFORM_KEYS.loanApplications, []);
        storage.set(PLATFORM_KEYS.verifications, []);
        storage.set(PLATFORM_KEYS.riskFlags, []);
        // Any farmer signed in on this device is signed out (their account is gone).
        storage.remove('session');
        storage.remove('guestId');
        return { farmers: users.filter((u) => !u.isGuest).length };
      },
    );
  },

  /** Rebuilds the seeded demo world. Real accounts, the team and the audit trail are kept. */
  async resetDemo(confirmation: string): Promise<{ farmers: number }> {
    await delay();
    return withAudit(
      {
        permission: 'data.manage',
        action: 'system.reset_demo',
        targetType: 'system',
        summary: 'Reset the demo data',
        before: platformCounts(),
        after: () => platformCounts(),
      },
      async () => {
        if (confirmation !== RESET_CONFIRMATION) {
          throw new Error(`Type ${RESET_CONFIRMATION} to confirm the reset.`);
        }
        clearSeedData();
        await seedPlatform({ force: true });
        return { farmers: readUsers().length };
      },
    );
  },
};
