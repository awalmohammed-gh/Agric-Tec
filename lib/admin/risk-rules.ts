// Fraud and risk detection rules. Pure functions: farmers' data in, suspected issues out.
// risk.service stores new results as RiskFlags; the seed runs the same rules on planted data.

import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { formatDate, formatGHS, parseISODate } from '@/lib/format';
import { normalizePhone } from '@/lib/profile';
import type { FarmRecord, MomoTransaction, Profile } from '@/types';
import type { RiskFlag, RiskRuleId } from '@/types/admin';

export interface RiskSubject {
  userId: string;
  profile: Profile;
  records: FarmRecord[];
  momo: MomoTransaction[];
}

export type DetectedRisk = Pick<
  RiskFlag,
  'userId' | 'rule' | 'severity' | 'description' | 'relatedIds'
>;

export interface RiskRule {
  id: RiskRuleId;
  label: string;
  /** What the rule looks for, shown on the risk page. */
  explanation: string;
  severity: RiskFlag['severity'];
  detect: (subjects: RiskSubject[]) => DetectedRisk[];
}

/** Thresholds, kept together so A13 can show them next to each rule. */
export const RISK_THRESHOLDS = {
  /** An amount more than this many times the farmer's median for that record type. */
  outlierMultiple: 5,
  outlierMinAmount: 5000,
  outlierMinSamples: 5,
  /** This many records dated on one day. */
  burstPerDay: 10,
  /** One month's income at least this many times the average of the farmer's other income months. */
  spikeMultiple: 4,
  spikeMinAmount: 10000,
  spikeMinOtherMonths: 3,
  /** This many records entered on one day for dates at least `backdatedDays` earlier. */
  backdatedPerDay: 8,
  backdatedDays: 30,
} as const;

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  return groups;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

/** One flag per farmer in each group of two or more farmers sharing the same value. */
function sharedValue(
  subjects: RiskSubject[],
  rule: RiskRuleId,
  severity: RiskFlag['severity'],
  value: (subject: RiskSubject) => string,
  describe: (others: number) => string,
): DetectedRisk[] {
  const flags: DetectedRisk[] = [];
  for (const group of groupBy(subjects, value).values()) {
    if (group.length < 2) continue;
    for (const subject of group) {
      flags.push({
        userId: subject.userId,
        rule,
        severity,
        description: describe(group.length - 1),
        relatedIds: group.filter((s) => s.userId !== subject.userId).map((s) => s.userId),
      });
    }
  }
  return flags;
}

export const RISK_RULES: RiskRule[] = [
  {
    id: 'duplicate_momo_ref',
    label: 'Duplicate MoMo reference',
    explanation: 'The same MoMo reference appears on more than one of a farmer’s transactions.',
    severity: 'high',
    detect: (subjects) =>
      subjects.flatMap((s) =>
        [...groupBy(s.momo, (t) => t.reference.trim().toUpperCase()).entries()]
          .filter(([, group]) => group.length > 1)
          .map(([reference, group]) => ({
            userId: s.userId,
            rule: 'duplicate_momo_ref' as const,
            severity: 'high' as const,
            description: `MoMo reference ${reference} is used on ${group.length} transactions.`,
            relatedIds: ids(group),
          })),
      ),
  },
  {
    id: 'amount_outlier',
    label: 'Unusual amount',
    explanation: `An income or expense more than ${RISK_THRESHOLDS.outlierMultiple}× the farmer’s typical amount for that type.`,
    severity: 'medium',
    detect: (subjects) =>
      subjects.flatMap((s) =>
        (['income', 'expense'] as const).flatMap((type) => {
          const ofType = s.records.filter((r) => r.type === type);
          if (ofType.length < RISK_THRESHOLDS.outlierMinSamples) return [];
          const typical = median(ofType.map((r) => r.amount));
          return ofType
            .filter(
              (r) =>
                r.amount >= RISK_THRESHOLDS.outlierMinAmount &&
                r.amount > typical * RISK_THRESHOLDS.outlierMultiple,
            )
            .map((r) => ({
              userId: s.userId,
              rule: 'amount_outlier' as const,
              severity: 'medium' as const,
              description: `${type === 'income' ? 'Income' : 'Expense'} of ${formatGHS(r.amount)} is ${Math.round(r.amount / typical)}× this farmer’s typical ${type} (${formatGHS(typical)}).`,
              relatedIds: [r.id],
            }));
        }),
      ),
  },
  {
    id: 'burst_entries',
    label: 'Burst of entries',
    explanation: `${RISK_THRESHOLDS.burstPerDay} or more farm records dated on the same day.`,
    severity: 'medium',
    detect: (subjects) =>
      subjects.flatMap((s) =>
        [...groupBy(s.records, (r) => r.date).entries()]
          .filter(([, group]) => group.length >= RISK_THRESHOLDS.burstPerDay)
          .map(([date, group]) => ({
            userId: s.userId,
            rule: 'burst_entries' as const,
            severity: 'medium' as const,
            description: `${group.length} records are dated ${formatDate(date)}.`,
            relatedIds: ids(group),
          })),
      ),
  },
  {
    id: 'income_spike',
    label: 'Income spike',
    explanation: `A month’s income at least ${RISK_THRESHOLDS.spikeMultiple}× the farmer’s average for other months.`,
    severity: 'medium',
    detect: (subjects) =>
      subjects.flatMap((s) => {
        const months = groupBy(
          s.records.filter((r) => r.type === 'income' && r.amount > 0),
          (r) => r.date.slice(0, 7),
        );
        if (months.size < RISK_THRESHOLDS.spikeMinOtherMonths + 1) return [];
        const totals = [...months.entries()].map(([month, group]) => ({
          month,
          group,
          total: group.reduce((sum, r) => sum + r.amount, 0),
        }));
        // Only the largest month is flagged, so one spike gives one flag.
        const top = totals.reduce((a, b) => (b.total > a.total ? b : a));
        const others = totals.filter((t) => t !== top);
        const average = others.reduce((sum, t) => sum + t.total, 0) / others.length;
        if (
          top.total < RISK_THRESHOLDS.spikeMinAmount ||
          top.total < average * RISK_THRESHOLDS.spikeMultiple
        ) {
          return [];
        }
        return [
          {
            userId: s.userId,
            rule: 'income_spike' as const,
            severity: 'medium' as const,
            description: `Income in ${format(parseISODate(`${top.month}-01`), 'MMMM yyyy')} was ${formatGHS(top.total)}, ${Math.round(top.total / average)}× the average of other months (${formatGHS(average)}).`,
            relatedIds: ids(top.group),
          },
        ];
      }),
  },
  {
    id: 'shared_phone',
    label: 'Shared phone number',
    explanation: 'Two or more farmer accounts use the same phone number.',
    severity: 'high',
    detect: (subjects) =>
      sharedValue(
        subjects,
        'shared_phone',
        'high',
        (s) => (s.profile.phone.trim() ? normalizePhone(s.profile.phone) : ''),
        (others) =>
          `This phone number is also used by ${others} other account${others === 1 ? '' : 's'}.`,
      ),
  },
  {
    id: 'shared_ghana_card',
    label: 'Shared Ghana Card',
    explanation: 'Two or more verified farmers have a Ghana Card with the same ending.',
    severity: 'medium',
    detect: (subjects) =>
      sharedValue(
        subjects,
        'shared_ghana_card',
        'medium',
        (s) => (s.profile.verification.ghanaCard ? (s.profile.ghanaCardLast4 ?? '') : ''),
        (others) =>
          `A verified Ghana Card ending in the same digits is on ${others} other account${others === 1 ? '' : 's'}.`,
      ),
  },
  {
    id: 'backdated_bulk',
    label: 'Backdated bulk entry',
    explanation: `${RISK_THRESHOLDS.backdatedPerDay} or more records entered on one day for dates over ${RISK_THRESHOLDS.backdatedDays} days earlier.`,
    severity: 'low',
    detect: (subjects) =>
      subjects.flatMap((s) =>
        [...groupBy(s.records, (r) => format(parseISO(r.createdAt), 'yyyy-MM-dd')).entries()]
          .map(([day, group]) => ({
            day,
            backdated: group.filter(
              (r) =>
                differenceInCalendarDays(parseISODate(day), parseISODate(r.date)) >=
                RISK_THRESHOLDS.backdatedDays,
            ),
          }))
          .filter(({ backdated }) => backdated.length >= RISK_THRESHOLDS.backdatedPerDay)
          .map(({ day, backdated }) => ({
            userId: s.userId,
            rule: 'backdated_bulk' as const,
            severity: 'low' as const,
            description: `${backdated.length} records entered on ${formatDate(day)} are dated more than ${RISK_THRESHOLDS.backdatedDays} days earlier.`,
            relatedIds: ids(backdated),
          })),
      ),
  },
];

export const RISK_RULE_LABELS = Object.fromEntries(
  RISK_RULES.map((rule) => [rule.id, rule.label]),
) as Record<RiskRuleId, string>;

/** Runs every rule over every farmer. */
export function detectRisks(subjects: RiskSubject[]): DetectedRisk[] {
  return RISK_RULES.flatMap((rule) => rule.detect(subjects));
}

/** Identifies "the same finding": a new scan never re-adds a flag that already exists. */
export function riskKey(flag: Pick<RiskFlag, 'rule' | 'userId' | 'relatedIds'>): string {
  return `${flag.rule}|${flag.userId}|${[...flag.relatedIds].sort().join(',')}`;
}
