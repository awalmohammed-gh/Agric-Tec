'use client';

import { BarChart } from '@/components/charts/bar-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { scoreDistribution } from '@/lib/admin/analytics';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { CreditConfig } from '@/types/admin';

/** How many farmers sit in each score band (the admin's bands, default 500 / 650 / 750). */
export function ScoreDistributionChart({ bands }: { bands?: CreditConfig['bands'] }) {
  const farmers = useAdminDataStore((s) => s.farmers);
  const { palette } = useChartTheme();
  const buckets = scoreDistribution(farmers, bands);
  const colors = [palette.danger, palette.gold, palette.accent, palette.purple];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Credit score bands</CardTitle>
          <CardSub>All farmers, by their current score</CardSub>
        </div>
      </CardHeader>
      <BarChart
        labels={buckets.map((b) => `${b.band} (${b.label})`)}
        datasets={[
          {
            label: 'Farmers',
            data: buckets.map((b) => b.count),
            color: palette.purple,
            colorsPerBar: colors,
          },
        ]}
        height={240}
        showLegend={false}
        ariaLabel={`Farmers by credit score band: ${buckets.map((b) => `${b.band} ${b.count}`).join(', ')}`}
      />
    </Card>
  );
}
