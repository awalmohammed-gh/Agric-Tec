'use client';

import { DoughnutChart } from '@/components/charts/doughnut-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';

export function CropDistributionChart() {
  const { incomeByCrop } = useFarmStats();
  const { palette } = useChartTheme();
  const colors = [
    palette.accent,
    palette.gold,
    palette.purple,
    palette.info,
    palette.warning,
    palette.danger,
  ];

  // Largest share first, so the biggest earner always gets the brand colour.
  const entries = Object.entries(incomeByCrop)
    .filter(([, total]) => total > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Income by Crop</CardTitle>
          <CardSub>Crop distribution of all income</CardSub>
        </div>
      </CardHeader>
      <DoughnutChart
        ariaLabel="Income by crop"
        labels={entries.map(([crop]) => crop)}
        data={entries.map(([, total]) => total)}
        colors={entries.map((_, i) => colors[i % colors.length])}
      />
    </Card>
  );
}
