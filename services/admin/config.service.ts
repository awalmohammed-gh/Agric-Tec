import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import type { ScoringInput } from '@/lib/admin/credit-rules';
import { DEFAULT_CREDIT_CONFIG, DEFAULT_FLAGS, DEFAULT_PLANS } from '@/lib/admin/defaults';
import { readFarmerData, readUsers } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  creditConfigInputSchema,
  featureFlagsSchema,
  parseOrThrow,
  plansSchema,
} from '@/lib/admin/schemas';
import { delay, storage } from '@/services/storage';
import type { CreditConfig, CreditConfigInput, FeatureFlags, Plan } from '@/types/admin';

const readCredit = () =>
  storage.get<CreditConfig>(PLATFORM_KEYS.creditConfig, DEFAULT_CREDIT_CONFIG);
const readHistory = () => storage.get<CreditConfig[]>(PLATFORM_KEYS.creditHistory, []);

/** The feature flags right now, without latency (auth.service checks them inside its own calls). */
export const readFlags = (): FeatureFlags => ({
  ...DEFAULT_FLAGS,
  ...storage.get<Partial<FeatureFlags>>(PLATFORM_KEYS.flags, {}),
});

/**
 * Saves `input` as the next version and moves the current one into history. Every version is
 * kept for good: history is never trimmed or rewritten (restoring adds a new version).
 */
function writeCreditVersion(
  input: CreditConfigInput,
  extra: { note?: string; restoredFrom?: number } = {},
): CreditConfig {
  const valid = parseOrThrow(creditConfigInputSchema, input);
  const current = readCredit();
  const next: CreditConfig = {
    ...valid,
    version: Math.max(current.version, ...readHistory().map((c) => c.version)) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentAdmin()?.name ?? 'Admin',
    ...(extra.note && { note: extra.note }),
    ...(extra.restoredFrom && { restoredFrom: extra.restoredFrom }),
  };
  storage.set(PLATFORM_KEYS.creditHistory, [current, ...readHistory()]);
  storage.set(PLATFORM_KEYS.creditConfig, next);
  return next;
}

/** A publish note: at least 10 characters, so the history explains every change. */
function checkNote(note: string): string {
  const clean = note.trim().replace(/\s+/g, ' ');
  if (clean.length < 10) throw new Error('Add a change note of at least 10 characters.');
  if (clean.length > 500) throw new Error('Keep the change note under 500 characters.');
  return clean;
}

const creditValues = ({
  weights,
  targets,
  bands,
  eligibility,
}: CreditConfig): CreditConfigInput => ({
  weights,
  targets,
  bands,
  eligibility,
});

export const configService = {
  /** Read by the farmer app's credit score and loan eligibility, so no admin check. */
  async getCreditConfig(): Promise<CreditConfig> {
    await delay();
    return readCredit();
  },

  /** Bumps the version and keeps the previous one in history. */
  async saveCreditConfig(input: CreditConfigInput): Promise<CreditConfig> {
    await delay();
    const current = readCredit();
    return withAudit(
      {
        permission: 'credit.configure',
        action: 'credit.update',
        targetType: 'config',
        targetId: 'credit-config',
        summary: `Saved credit rules as version ${current.version + 1}`,
        before: creditValues(current),
        after: (saved) => ({ version: saved.version, ...creditValues(saved) }),
      },
      async () => writeCreditVersion(input),
    );
  },

  /**
   * Publishes the credit rules edited as a draft in the console: a new version with the change
   * note, the previous one kept in history, and an audit entry with before and after. Farmers'
   * scores follow at once. Weights that don't add up to 100 (or any invalid value) are refused.
   */
  async publishCreditConfig(input: CreditConfigInput, note: string): Promise<CreditConfig> {
    await delay();
    const current = readCredit();
    return withAudit(
      {
        permission: 'credit.configure',
        action: 'credit.publish',
        targetType: 'config',
        targetId: 'credit-config',
        summary: `Published credit rules version ${current.version + 1}: ${note.trim()}`,
        before: { version: current.version, ...creditValues(current) },
        after: (saved) => ({ version: saved.version, note: saved.note, ...creditValues(saved) }),
      },
      async () => {
        const clean = checkNote(note);
        const valid = parseOrThrow(creditConfigInputSchema, input);
        if (
          JSON.stringify(creditValues({ ...current, ...valid })) ===
          JSON.stringify(creditValues(current))
        )
          throw new Error('Nothing changed: the draft matches the live rules.');
        return writeCreditVersion(valid, { note: clean });
      },
    );
  },

  /** Previous versions, newest first. */
  async getCreditHistory(): Promise<CreditConfig[]> {
    await delay();
    requirePermission('credit.configure');
    return readHistory();
  },

  /**
   * Restoring saves the old values as a NEW version (with a note), so nothing in the history is
   * ever rewritten or lost.
   */
  async restoreCreditVersion(version: number, note?: string): Promise<CreditConfig> {
    await delay();
    const current = readCredit();
    const target = [current, ...readHistory()].find((c) => c.version === version);
    return withAudit(
      {
        permission: 'credit.configure',
        action: 'credit.restore',
        targetType: 'config',
        targetId: 'credit-config',
        summary: `Restored credit rules from version ${version}`,
        before: { version: current.version, ...creditValues(current) },
        after: (saved) => ({
          version: saved.version,
          restoredFrom: version,
          ...creditValues(saved),
        }),
      },
      async () => {
        if (!target) throw new Error(`Version ${version} was not found.`);
        if (target.version === current.version) throw new Error('That version is already live.');
        const clean = note?.trim() ? checkNote(note) : `Restored version ${version}.`;
        return writeCreditVersion(creditValues(target), { note: clean, restoredFrom: version });
      },
    );
  },

  /**
   * What the score needs for every registered farmer (records, MoMo, profile), so the console
   * can preview a draft's impact without saving anything. Only for credit.configure.
   */
  async getScoringInputs(): Promise<ScoringInput[]> {
    await delay();
    requirePermission('credit.configure');
    return readUsers()
      .filter((u) => !u.isGuest)
      .map((user) => {
        const data = readFarmerData(user.id);
        return {
          userId: user.id,
          name: data.profile.name || user.email,
          region: data.profile.region,
          records: data.records,
          momo: data.momo,
          profile: data.profile,
        };
      });
  },

  /** Read by the farmer app (navigation, maintenance mode, signup), so no admin check. */
  async getFlags(): Promise<FeatureFlags> {
    await delay();
    return readFlags();
  },

  async saveFlags(flags: FeatureFlags): Promise<FeatureFlags> {
    await delay();
    const before = await configService.getFlags();
    const changed = (Object.keys(flags) as (keyof FeatureFlags)[]).filter(
      (key) => flags[key] !== before[key],
    );
    return withAudit(
      {
        permission: 'settings.manage',
        action: 'settings.flags',
        targetType: 'system',
        targetId: 'feature-flags',
        summary: changed.length
          ? `Changed feature flags: ${changed.join(', ')}`
          : 'Saved feature flags (no changes)',
        before: Object.fromEntries(changed.map((key) => [key, before[key]])),
        after: (saved) => Object.fromEntries(changed.map((key) => [key, saved[key]])),
      },
      async () => {
        const valid = parseOrThrow(featureFlagsSchema, flags);
        storage.set(PLATFORM_KEYS.flags, valid);
        return valid;
      },
    );
  },

  async getPlans(): Promise<Plan[]> {
    await delay();
    return storage.get<Plan[]>(PLATFORM_KEYS.plans, DEFAULT_PLANS);
  },

  async savePlans(plans: Plan[]): Promise<Plan[]> {
    await delay();
    const before = await configService.getPlans();
    return withAudit(
      {
        permission: 'settings.manage',
        action: 'settings.plans',
        targetType: 'system',
        targetId: 'plans',
        summary: 'Updated subscription plans',
        before,
      },
      async () => {
        const valid = parseOrThrow(plansSchema, plans);
        storage.set(PLATFORM_KEYS.plans, valid);
        return valid;
      },
    );
  },
};
