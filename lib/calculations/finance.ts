import {
  differenceInCalendarMonths,
  format,
  getMonth,
  getYear,
  isAfter,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { parseISODate } from '@/lib/format';
import type { FarmRecord, MomoTransaction, MonthlySeries } from '@/types';

const round1 = (value: number) => Math.round(value * 10) / 10;

const sumBy = <T>(items: T[], pick: (item: T) => number) =>
  items.reduce((total, item) => total + pick(item), 0);

const incomeOf = (r: FarmRecord) => (r.type === 'income' ? r.amount : 0);
const expenseOf = (r: FarmRecord) => (r.type === 'expense' ? r.amount : 0);
const netOf = (r: FarmRecord) => incomeOf(r) - expenseOf(r);

/** The first day of each of the last N months, oldest first, ending with the current month. */
function lastMonths(months: number): Date[] {
  const thisMonth = startOfMonth(new Date());
  return Array.from({ length: months }, (_, i) => subMonths(thisMonth, months - 1 - i));
}

export function totalIncome(records: FarmRecord[]): number {
  return sumBy(records, incomeOf);
}

export function totalExpenses(records: FarmRecord[]): number {
  return sumBy(records, expenseOf);
}

export function netProfit(records: FarmRecord[]): number {
  return totalIncome(records) - totalExpenses(records);
}

/** (profit / income) × 100 to 1 decimal place, or 0 when there is no income. */
export function profitMargin(records: FarmRecord[]): number {
  const income = totalIncome(records);
  if (income <= 0) return 0;
  return round1((netProfit(records) / income) * 100);
}

/** Income in the current calendar year. */
export function ytdIncome(records: FarmRecord[]): number {
  const year = getYear(new Date());
  return sumBy(
    records.filter((r) => getYear(parseISODate(r.date)) === year),
    incomeOf,
  );
}

/** Income and expenses for the last N months, labelled "May", "Jun", … */
export function monthlySeries(records: FarmRecord[], months: number): MonthlySeries {
  const buckets = lastMonths(months);
  return {
    labels: buckets.map((month) => format(month, 'MMM')),
    income: buckets.map((month) =>
      sumBy(
        records.filter((r) => isSameMonth(parseISODate(r.date), month)),
        incomeOf,
      ),
    ),
    expense: buckets.map((month) =>
      sumBy(
        records.filter((r) => isSameMonth(parseISODate(r.date), month)),
        expenseOf,
      ),
    ),
  };
}

/** 12 values (Jan–Dec) of net income for the current year only. */
export function currentYearNetByMonth(records: FarmRecord[]): number[] {
  const year = getYear(new Date());
  const net = Array.from({ length: 12 }, () => 0);
  for (const record of records) {
    const date = parseISODate(record.date);
    if (getYear(date) === year) net[getMonth(date)] += netOf(record);
  }
  return net;
}

export function incomeByCrop(records: FarmRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const record of records) {
    if (record.type !== 'income') continue;
    totals[record.crop] = (totals[record.crop] ?? 0) + record.amount;
  }
  return totals;
}

export function momoTotals(momo: MomoTransaction[]): {
  inflow: number;
  outflow: number;
  net: number;
  count: number;
} {
  const inflow = sumBy(momo, (t) => (t.direction === 'in' ? t.amount : 0));
  const outflow = sumBy(momo, (t) => (t.direction === 'out' ? t.amount : 0));
  return { inflow, outflow, net: inflow - outflow, count: momo.length };
}

/** Inflows (income) and outflows (expense) for the last N months. */
export function momoMonthlySeries(momo: MomoTransaction[], months: number): MonthlySeries {
  const buckets = lastMonths(months);
  const inMonth = (month: Date) => momo.filter((t) => isSameMonth(parseISODate(t.date), month));
  return {
    labels: buckets.map((month) => format(month, 'MMM')),
    income: buckets.map((month) =>
      sumBy(inMonth(month), (t) => (t.direction === 'in' ? t.amount : 0)),
    ),
    expense: buckets.map((month) =>
      sumBy(inMonth(month), (t) => (t.direction === 'out' ? t.amount : 0)),
    ),
  };
}

/**
 * Net profit over the last 12 months. When the data covers fewer months,
 * the profit is scaled up to a full year: profit / monthsSpanned × 12.
 */
export function annualizedNetProfit(records: FarmRecord[]): number {
  const now = new Date();
  const cutoff = subMonths(now, 12);
  const recent = records.filter((r) => isAfter(parseISODate(r.date), cutoff));
  if (recent.length === 0) return 0;

  const earliest = recent.reduce((min, r) => {
    const date = parseISODate(r.date);
    return date < min ? date : min;
  }, parseISODate(recent[0].date));
  const monthsSpanned = Math.min(12, Math.max(1, differenceInCalendarMonths(now, earliest) + 1));
  return Math.round((netProfit(recent) / monthsSpanned) * 12);
}

/** Financial health score from 20 to 100. */
export function financialHealth(records: FarmRecord[]): number {
  const score = 50 + (netProfit(records) > 0 ? 20 : 0) + Math.min(30, records.length * 2);
  return Math.min(100, Math.max(20, score));
}

/** Number of unique crops, not counting "Other". */
export function activeCropCount(records: FarmRecord[]): number {
  return new Set(records.map((r) => r.crop).filter((crop) => crop !== 'Other')).size;
}
