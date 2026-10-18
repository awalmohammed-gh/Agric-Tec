'use client';

import { BarChart } from '@/components/charts/bar-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';

export function MomoFlowChart() {
  const { momo } = useFarmStats();
  const { palette } = useChartTheme();

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>MoMo Cash Flow</CardTitle>
          <CardSub>Inflows vs outflows, last 6 months</CardSub>
        </div>
      </CardHeader>
      <BarChart
        ariaLabel="MoMo inflows versus outflows over the last 6 months"
        aspectRatio={2.6}
        labels={momo.monthly6.labels}
        datasets={[
          { label: 'Inflows', data: momo.monthly6.income, color: palette.accent },
          { label: 'Outflows', data: momo.monthly6.expense, color: palette.danger },
        ]}
      />
    </Card>
  );
}
