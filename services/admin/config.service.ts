import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { DEFAULT_CREDIT_CONFIG, DEFAULT_FLAGS, DEFAULT_PLANS } from '@/lib/admin/defaults';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  creditConfigInputSchema,
  featureFlagsSchema,
  parseOrThrow,
  plansSchema,
} from '@/lib/admin/schemas';
import { delay, storage } from '@/services/storage';
import type { CreditConfig, CreditConfigInput, FeatureFlags, Plan } from '@/types/admin';

/** Older versions kept for restore. */
const MAX_HISTORY = 50;

const readCredit = () =>
  storage.get<CreditConfig>(PLATFORM_KEYS.creditConfig, DEFAULT_CREDIT_CONFIG);
const readHistory = () => storage.get<CreditConfig[]>(PLATFORM_KEYS.creditHistory, []);

/** The feature flags right now, without latency (auth.service checks them inside its own calls). */
export const readFlags = (): FeatureFlags => ({
  ...DEFAULT_FLAGS,
  ...storage.get<Partial<FeatureFlags>>(PLATFORM_KEYS.flags, {}),
});

/** Saves `input` as the next version and moves the current one into history. */
function writeCreditVersion(input: CreditConfigInput): CreditConfig {
  const valid = parseOrThrow(creditConfigInputSchema, input);
  const current = readCredit();
  const next: CreditConfig = {
    ...valid,
    version: Math.max(current.version, ...readHistory().map((c) => c.version)) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: getCurrentAdmin()?.name ?? 'Admin',
  };
  storage.set(PLATFORM_KEYS.creditHistory, [current, ...readHistory()].slice(0, MAX_HISTORY));
  storage.set(PLATFORM_KEYS.creditConfig, next);
  return next;
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

  /** Previous versions, newest first. */
  async getCreditHistory(): Promise<CreditConfig[]> {
    await delay();
    requirePermission('credit.configure');
    return readHistory();
  },

  /** Restoring saves the old values as a new version, so nothing in the history is lost. */
  async restoreCreditVersion(version: number): Promise<CreditConfig> {
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
        before: creditValues(current),
        after: (saved) => ({ version: saved.version, restoredFrom: version }),
      },
      async () => {
        if (!target) throw new Error(`Version ${version} was not found.`);
        if (target.version === current.version) throw new Error('That version is already live.');
        return writeCreditVersion(creditValues(target));
      },
    );
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
