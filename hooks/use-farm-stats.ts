import {
  calculateCreditScore,
  isProfileComplete,
  scoreLabel,
} from '@/lib/calculations/credit-score';
import {
  activeCropCount,
  activeCropList,
  annualizedNetProfit,
  currentYearNetByMonth,
  expenseByCategory,
  financialHealth,
  incomeByCrop,
  momoMonthlySeries,
  momoTotals,
  monthlySeries,
  netProfit,
  percentChange,
  profitMargin,
  totalExpenses,
  totalIncome,
  ytdIncome,
} from '@/lib/calculations/finance';
import { useFarmStore } from '@/store/farm-store';
import { useProfileStore } from '@/store/profile-store';
import type { ReadinessItem } from '@/types';

const MIN_RECORDS = 5;

/**
 * Every derived number the pages need, computed from the stores.
 * Nothing here is stored, and the React Compiler memoizes it, so there is no useMemo.
 */
export function useFarmStats() {
  const records = useFarmStore((s) => s.records);
  const momo = useFarmStore((s) => s.momo);
  const profile = useProfileStore((s) => s.profile);

  const credit = calculateCreditScore(records, momo, profile);
  const momoSummary = momoTotals(momo);
  const profileComplete = isProfileComplete(profile);
  const monthly6 = monthlySeries(records, 6);
  const momo6 = momoMonthlySeries(momo, 6);
  const momoNet6 = momo6.income.map((inflow, i) => inflow - momo6.expense[i]);

  /** This month vs last month, from the last two points of a 6-month series. */
  const monthOverMonth = (series: number[]) => percentChange(series[5] ?? 0, series[4] ?? 0);

  const readiness: ReadinessItem[] = [
    {
      key: 'account',
      label: 'Account Created',
      description: 'Your AgriCtec account is active.',
      done: true,
    },
    {
      key: 'records',
      label: 'Financial Records',
      description: `${Math.min(records.length, MIN_RECORDS)} of ${MIN_RECORDS} farm records logged.`,
      done: records.length >= MIN_RECORDS,
    },
    {
      key: 'momo',
      label: 'MoMo Integration',
      description:
        momo.length > 0
          ? `${momo.length} MoMo transaction${momo.length === 1 ? '' : 's'} recorded.`
          : 'Log at least one MoMo transaction.',
      done: momo.length >= 1,
    },
    {
      key: 'profile',
      label: 'Profile Complete',
      description: profileComplete
        ? 'Name, phone, farm name and acreage are filled in.'
        : 'Add your name, phone, farm name and acreage.',
      done: profileComplete,
    },
    {
      key: 'ghanaCard',
      label: 'Ghana Card',
      description: profile?.verification.ghanaCard
        ? 'Your Ghana Card is verified.'
        : 'Verify your Ghana Card in your profile.',
      done: profile?.verification.ghanaCard ?? false,
    },
  ];

  return {
    income: totalIncome(records),
    expenses: totalExpenses(records),
    profit: netProfit(records),
    margin: profitMargin(records),
    ytdIncome: ytdIncome(records),
    activeCrops: activeCropCount(records),
    activeCropList: activeCropList(records),
    acres: profile?.acres ?? 0,
    monthly6,
    monthly12: monthlySeries(records, 12),
    currentYearNet: currentYearNetByMonth(records),
    incomeByCrop: incomeByCrop(records),
    expenseByCategory: expenseByCategory(records),
    momo: { ...momoSummary, monthly6: momo6, netSeries6: momoNet6 },
    /** % change this month vs last month; null when last month was 0. */
    trends: {
      income: monthOverMonth(monthly6.income),
      expenses: monthOverMonth(monthly6.expense),
      momoNet: monthOverMonth(momoNet6),
    },
    credit,
    creditLabel: scoreLabel(credit.score),
    health: financialHealth(records),
    annualizedProfit: annualizedNetProfit(records),
    readiness,
    recordCount: records.length,
    profileComplete,
    hasData: records.length > 0 || momo.length > 0,
  };
}

export type FarmStats = ReturnType<typeof useFarmStats>;
