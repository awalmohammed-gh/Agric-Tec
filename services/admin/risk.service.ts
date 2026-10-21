import { getCurrentAdmin, requirePermission } from '@/lib/admin/admin-session';
import { withAudit } from '@/lib/admin/audit';
import { readProfile, readRiskSubjects } from '@/lib/admin/farmer-data';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { detectRisks, RISK_RULE_LABELS, riskKey } from '@/lib/admin/risk-rules';
import { generateId } from '@/lib/utils';
import { delay, storage } from '@/services/storage';
import type { RiskFlag, RiskFlagFilter } from '@/types/admin';

const read = () => storage.get<RiskFlag[]>(PLATFORM_KEYS.riskFlags, []);
const write = (items: RiskFlag[]) => storage.set(PLATFORM_KEYS.riskFlags, items);

const SEVERITY_ORDER: Record<RiskFlag['severity'], number> = { high: 0, medium: 1, low: 2 };

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

  async confirm(id: string, note: string): Promise<RiskFlag> {
    await delay();
    return review(id, 'confirmed', note);
  },
};
