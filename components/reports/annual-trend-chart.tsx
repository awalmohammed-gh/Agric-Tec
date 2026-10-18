'use client';

import { LineChart } from '@/components/charts/line-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { sumSeries } from '@/lib/calculations/finance';
import { formatGHS } from '@/lib/format';

/** 12-month income vs expenses, with the period totals as legend chips. */
export function AnnualTrendChart() {
  const { monthly12, hasData } = useFarmStats();
  const { palette } = useChartTheme();
  const income = sumSeries(monthly12.income);
  const expenses = sumSeries(monthly12.expense);

  const chips = [
    { label: 'Income', value: formatGHS(income), dot: 'bg-accent' },
    { label: 'Expenses', value: formatGHS(expenses), dot: 'bg-danger' },
    { label: 'Net', value: formatGHS(income - expenses), dot: 'bg-purple' },
  ];

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Annual Trend</CardTitle>
          <CardSub>Income vs expenses over the last 12 months</CardSub>
        </div>
      </CardHeader>
      <dl className="mb-4 flex flex-wrap gap-3">
        {chips.map((chip) => (
          <div key={chip.label} className="border-border bg-glass rounded-xl border px-3 py-2">
            <dt className="text-text-mute flex items-center gap-1.5 text-[11px]">
              <span aria-hidden="true" className={`size-2 rounded-full ${chip.dot}`} /> {chip.label}
            </dt>
            <dd className="text-text text-sm font-bold">{chip.value}</dd>
          </div>
        ))}
      </dl>
      <div className="relative">
        <LineChart
          height={280}
          showLegend={false}
          ariaLabel="Income versus expenses over the last 12 months"
          labels={monthly12.labels}
          datasets={[
            { label: 'Income', data: monthly12.income, color: palette.accent, fill: true },
            { label: 'Expenses', data: monthly12.expense, color: palette.danger, fill: true },
          ]}
        />
        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="glass text-text-dim rounded-full px-4 py-2 text-sm">
              Add records to see your yearly trend
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
