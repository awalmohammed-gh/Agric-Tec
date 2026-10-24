import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { farmersService } from '@/services/admin/farmers.service';
import { withAudit } from '@/lib/admin/audit';
import {
  buildFarmerAccount,
  readFarmerData,
  readProfile,
  readRiskSubjects,
  readUsers,
} from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import {
  detectRisks,
  RISK_RULE_LABELS,
  riskKey,
  ruleById,
  SEVERITY_ORDER,
  type RelatedKind,
} from '@/lib/admin/risk-rules';
import { generateId } from '@/lib/utils';
import { delay, storage } from '@/services/storage';
import type { FarmRecord, MomoTransaction } from '@/types';
import type { FarmerAccount, RiskFlag, RiskFlagFilter } from '@/types/admin';

/** A flag's evidence for the review screen. `related` marks the items the flag is about. */
export interface RiskRelated {
  kind: RelatedKind;
  farmer: FarmerAccount;
  /** Shared phone or Ghana Card: the flagged farmer first, then the linked accounts. */
  accounts: FarmerAccount[];
  /** The farmer's transactions, plus the related ones on other accounts (with the owner). */
  momo: (MomoTransaction & { ownerName: string; related: boolean })[];
  /** The farmer's records. */
  records: (FarmRecord & { related: boolean })[];
}

const read = () => storage.get<RiskFlag[]>(PLATFORM_KEYS.riskFlags, []);
const write = (items: RiskFlag[]) => storage.set(PLATFORM_KEYS.riskFlags, items);

function review(id: string, status: 'dismissed' | 'confirmed', note: string): Promise<RiskFlag> {
  const flag = read().find((f) => f.id === id);
  if (!flag) return Promise.reject(new Error('Risk flag not found.'));
  return withAudit(
    {
      permission: 'risk.review',
      action: status === 'dismissed' ? 'risk.dismiss' : 'risk.confirm',
      targetType: 'risk',
      targetId: id,
      summary: `${status === 'dismissed' ? 'Dismissed' : 'Confirmed'} “${RISK_RULE_LABELS[flag.rule]}” for ${readProfile(flag.userId).name || 'a farmer'}`,
      before: { status: flag.status },
      after: (updated) => ({ status: updated.status, note: updated.note }),
    },
    async () => {
      if (flag.status !== 'open') throw new Error('This flag has already been reviewed.');
      if (note.trim().length < 3) throw new Error('Add a short note explaining your decision.');
      const updated: RiskFlag = {
        ...flag,
        status,
        reviewedBy: getCurrentAdmin()?.name ?? 'Admin',
        reviewedAt: new Date().toISOString(),
        note: note.trim(),
      };
      write(read().map((f) => (f.id === id ? updated : f)));
      return updated;
    },
  );
}

export const riskService = {
  /**
   * Runs every rule over every farmer and stores only findings that are new. A finding is the same
   * when rule + farmer + related IDs match, whatever its status, so a dismissed flag never returns.
   */
  async runScan(): Promise<RiskFlag[]> {
    await delay();
    return withAudit(
      {
        permission: 'risk.review',
        action: 'risk.scan',
        targetType: 'risk',
        summary: 'Ran a risk scan',
        after: (found) => ({ newFlags: found.length, ids: found.map((f) => f.id) }),
      },
      async () => {
        const existing = read();
        const known = new Set(existing.map(riskKey));
        const now = new Date().toISOString();
        const found: RiskFlag[] = [];
        for (const risk of detectRisks(readRiskSubjects())) {
          const key = riskKey(risk);
          if (known.has(key)) continue;
          known.add(key);
          found.push({ ...risk, id: generateId(), status: 'open', detectedAt: now });
        }
        if (found.length) write([...found, ...existing]);
        return found;
      },
    );
  },

  /** Open flags first, then by severity, then newest. */
  async list(filter: RiskFlagFilter = {}): Promise<RiskFlag[]> {
    await delay();
    requirePermission('risk.review');
    return read()
      .filter(
        (f) =>
          (!filter.status || f.status === filter.status) &&
          (!filter.severity || f.severity === filter.severity) &&
          (!filter.rule || f.rule === filter.rule) &&
          (!filter.userId || f.userId === filter.userId),
      )
      .sort(
        (a, b) =>
          Number(a.status !== 'open') - Number(b.status !== 'open') ||
          SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
          b.detectedAt.localeCompare(a.detectedAt),
      );
  },

  async dismiss(id: string, note: string): Promise<RiskFlag> {
    await delay();
    return review(id, 'dismissed', note);
  },

  /**
   * Confirms fraud. With `suspend`, the farmer is also suspended (its own audit entry); the
   * suspend permission is checked first, so nothing changes if it is missing.
   */
  async confirm(
    id: string,
    note: string,
    { suspend = false }: { suspend?: boolean } = {},
  ): Promise<RiskFlag> {
    await delay();
    if (suspend) requirePermission('farmers.suspend');
    const confirmed = await review(id, 'confirmed', note);
    const alreadySuspended =
      readUsers().find((u) => u.id === confirmed.userId)?.status === 'suspended';
    if (suspend && !alreadySuspended) {
      await farmersService.suspend(
        confirmed.userId,
        `Confirmed fraud (${RISK_RULE_LABELS[confirmed.rule]}): ${note.trim()}`,
      );
    }
    return confirmed;
  },

  /**
   * Everything a reviewer needs next to a flag: the flagged farmer, the related transactions or
   * records (with the farmer's other entries for context), or the linked accounts side by side.
   */
  async getRelated(id: string): Promise<RiskRelated> {
    await delay();
    requirePermission('risk.review');
    const flag = read().find((f) => f.id === id);
    if (!flag) throw new Error('Risk flag not found.');
    const related = new Set(flag.relatedIds);
    const users = readUsers();
    const accountOf = (userId: string) => {
      const user = users.find((u) => u.id === userId);
      return user ? buildFarmerAccount(user) : null;
    };
    const farmer = accountOf(flag.userId);
    if (!farmer) throw new Error('This farmer no longer exists.');
    const kind = ruleById(flag.rule).related;
    if (kind === 'accounts') {
      const others = flag.relatedIds
        .map(accountOf)
        .filter((a): a is NonNullable<typeof a> => a !== null);
      return { kind, farmer, accounts: [farmer, ...others], momo: [], records: [] };
    }
    if (kind === 'momo') {
      // A duplicate reference can sit on other accounts too: look through every farmer.
      const momo = users.flatMap((u) => {
        const data = readFarmerData(u.id);
        const own = u.id === flag.userId;
        return data.momo
          .filter((t) => related.has(t.id) || own)
          .map((t) => ({
            ...t,
            ownerName: data.profile.name || u.email,
            related: related.has(t.id),
          }));
      });
      return { kind, farmer, accounts: [], momo, records: [] };
    }
    const records = readFarmerData(flag.userId).records.map((r) => ({
      ...r,
      related: related.has(r.id),
    }));
    return { kind, farmer, accounts: [], momo: [], records };
  },

  /**
   * For the farmer's own app (no admin check): whether the account has confirmed flags, so
   * lender-facing reports say "Account under review". No flag details leave the console.
   */
  async underReview(userId: string): Promise<boolean> {
    await delay(0);
    return read().some((f) => f.userId === userId && f.status === 'confirmed');
  },
};
