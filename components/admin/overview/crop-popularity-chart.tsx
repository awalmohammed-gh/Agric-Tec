'use client';

import { DoughnutChart } from '@/components/charts/doughnut-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { cropPopularity } from '@/lib/admin/analytics';
import { useAdminDataStore } from '@/store/admin/admin-data-store';

/** Share of farmers growing each crop (a farmer can list several). */
export function CropPopularityChart() {
  const farmers = useAdminDataStore((s) => s.farmers);
  const { palette } = useChartTheme();
  const crops = cropPopularity(farmers);
  const colors = [
    palette.accent,
    palette.purple,
    palette.gold,
    palette.info,
    palette.warning,
    palette.danger,
    '#14b8a6',
    '#ec4899',
    '#94a3b8',
  ];
  const growers = farmers.filter((f) => !f.isGuest && f.profile.primaryCrops.length > 0).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Crop popularity</CardTitle>
          <CardSub>Primary crops listed by farmers</CardSub>
        </div>
      </CardHeader>
      <DoughnutChart
        labels={crops.map((c) => c.crop)}
        data={crops.map((c) => c.count)}
        colors={crops.map((_, i) => colors[i % colors.length])}
        aspectRatio={1.3}
        centerLabel={
          <>
            <span className="font-display text-text text-2xl font-bold">{growers}</span>
            <span className="text-text-mute text-xs">farmers</span>
          </>
        }
        ariaLabel={`Crop popularity: ${crops.map((c) => `${c.crop} ${c.count}`).join(', ')}`}
      />
    </Card>
  );
}
