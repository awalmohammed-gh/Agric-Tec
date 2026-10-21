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
import { readUsers } from '@/lib/admin/farmer-data';
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

export const IMPORT_CONFIRMATION = 'IMPORT';
export const RESET_CONFIRMATION = 'RESET';

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
      passwordHash: z.string(),
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

export const backupService = {
  /** One JSON file with every app key (except sign-ins, the team and the audit trail). */
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
            data[key] = JSON.parse(raw);
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
   * Replaces all platform and farmer data with the backup. The caller must pass "IMPORT" after the
   * admin confirms. Sign-ins, the team and the audit trail are never replaced. All or nothing.
   */
  async importAll(json: string, confirmation: string): Promise<{ keys: number }> {
    await delay();
    return withAudit(
      {
        permission: 'data.manage',
        action: 'system.import',
        targetType: 'system',
        summary: 'Imported a platform backup',
      },
      async () => {
        if (confirmation !== IMPORT_CONFIRMATION) {
          throw new Error(`Type ${IMPORT_CONFIRMATION} to confirm the import.`);
        }
        const backup = parsePlatformBackup(json);
        storage.replaceKeys(backup.data, (key) => PROTECTED.has(key));
        return { keys: Object.keys(backup.data).filter((key) => !PROTECTED.has(key)).length };
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
