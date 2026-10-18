'use client';

import { TrendingUp } from 'lucide-react';
import { LineChart } from '@/components/charts/line-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { AiChip } from '@/components/ui/ai-chip';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';

export function IncomeExpenseChart() {
  const { monthly6, hasData } = useFarmStats();
  const { palette } = useChartTheme();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Income vs Expenses</CardTitle>
          <CardSub>Last 6 months</CardSub>
        </div>
        <AiChip>
          <TrendingUp size={12} aria-hidden="true" /> AI Forecast
        </AiChip>
      </CardHeader>
      <div className="relative">
        <LineChart
          ariaLabel="Income versus expenses over the last 6 months"
          labels={monthly6.labels}
          datasets={[
            { label: 'Income', data: monthly6.income, color: palette.accent, fill: true },
            { label: 'Expenses', data: monthly6.expense, color: palette.danger, fill: true },
          ]}
        />
        {!hasData && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="glass text-text-dim rounded-full px-4 py-2 text-sm">
              Add records to see your trend
            </span>
          </p>
        )}
      </div>
    </Card>
  );
}
