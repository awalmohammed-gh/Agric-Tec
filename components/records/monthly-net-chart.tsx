'use client';

import { BarChart } from '@/components/charts/bar-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function MonthlyNetChart() {
  // currentYearNet only includes records from this calendar year.
  const { currentYearNet } = useFarmStats();
  const { palette } = useChartTheme();
  const year = new Date().getFullYear();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Monthly Net ({year})</CardTitle>
          <CardSub>Monthly breakdown: income minus expenses</CardSub>
        </div>
      </CardHeader>
      <BarChart
        ariaLabel={`Monthly net income for ${year}`}
        labels={MONTHS}
        datasets={[
          {
            label: 'Net (GHS)',
            data: currentYearNet,
            color: palette.accent,
            colorsPerBar: currentYearNet.map((net) => (net < 0 ? palette.danger : palette.accent)),
          },
        ]}
      />
    </Card>
  );
}
