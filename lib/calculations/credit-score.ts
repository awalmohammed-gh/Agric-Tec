import { isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { parseISODate } from '@/lib/format';
import { profitMargin, totalExpenses, totalIncome } from '@/lib/calculations/finance';
import type { CreditScoreBreakdown, FarmRecord, MomoTransaction, Profile } from '@/types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A profile is complete when name, phone, farm name and acres are all filled in. */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;
  return (
    profile.name.trim() !== '' &&
    profile.phone.trim() !== '' &&
    profile.farmName.trim() !== '' &&
    profile.acres > 0
  );
}

/** How many of the last 6 months (including this one) have at least one record or MoMo entry. */
function activeMonthsOfLastSix(records: FarmRecord[], momo: MomoTransaction[]): number {
  const dates = [...records, ...momo].map((item) => parseISODate(item.date));
  const thisMonth = startOfMonth(new Date());
  let active = 0;
  for (let i = 0; i < 6; i++) {
    const month = subMonths(thisMonth, i);
    if (dates.some((date) => isSameMonth(date, month))) active++;
  }
  return active;
}

function incomeStabilityFactor(records: FarmRecord[]): number {
  const income = totalIncome(records);
  if (income <= 0) return 0;
  const expenses = totalExpenses(records);
  if (income >= expenses) return Math.min(100, 50 + profitMargin(records));
  return Math.max(0, 50 - (expenses / income - 1) * 100);
}

/**
 * THE single credit score used everywhere (dashboard, loans, reports).
 * Five factors from 0 to 100 are weighted, then mapped onto 300–850.
 */
export function calculateCreditScore(
  records: FarmRecord[],
  momo: MomoTransaction[],
  profile: Profile | null,
): CreditScoreBreakdown {
  const paymentHistory = (activeMonthsOfLastSix(records, momo) / 6) * 100;
  const recordCompleteness = Math.min(100, ((records.length + momo.length) / 30) * 100);
  const incomeStability = incomeStabilityFactor(records);
  const momoActivity = Math.min(100, (momo.length / 20) * 100);

  const checks = [
    isProfileComplete(profile),
    profile?.verification.phone ?? false,
    profile?.verification.location ?? false,
    profile?.verification.ghanaCard ?? false,
  ];
  const verification = (checks.filter(Boolean).length / checks.length) * 100;

  const weighted =
    paymentHistory * 0.3 +
    recordCompleteness * 0.25 +
    incomeStability * 0.25 +
    momoActivity * 0.1 +
    verification * 0.1; // 0–100
  const score = Math.round(300 + (clamp(weighted, 0, 100) / 100) * 550); // 300–850

  return {
    score,
    paymentHistory: Math.round(paymentHistory),
    recordCompleteness: Math.round(recordCompleteness),
    incomeStability: Math.round(incomeStability),
    momoActivity: Math.round(momoActivity),
    verification: Math.round(verification),
  };
}

export function scoreLabel(score: number): 'Building' | 'Fair' | 'Good' | 'Excellent' {
  if (score < 500) return 'Building';
  if (score < 650) return 'Fair';
  if (score < 750) return 'Good';
  return 'Excellent';
}
