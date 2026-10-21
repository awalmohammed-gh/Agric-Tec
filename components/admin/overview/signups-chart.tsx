'use client';

import { LineChart } from '@/components/charts/line-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { DATE_RANGES, signupSeries, type DateRange } from '@/lib/admin/overview';
import { useAdminDataStore } from '@/store/admin/admin-data-store';

const UNIT_LABEL = { day: 'per day', week: 'per week', month: 'per month' } as const;

/** New farmers over the chosen range (daily, weekly or monthly buckets). */
export function SignupsChart({ range }: { range: DateRange }) {
  const farmers = useAdminDataStore((s) => s.farmers);
  const { palette } = useChartTheme();
  const series = signupSeries(farmers, range);
  const total = series.counts.reduce((a, b) => a + b, 0);
  const rangeLabel = DATE_RANGES.find((r) => r.value === range)?.label ?? '';

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sign-ups</CardTitle>
          <CardSub>
            {total} new farmer{total === 1 ? '' : 's'} · {rangeLabel.toLowerCase()},{' '}
            {UNIT_LABEL[series.unit]}
          </CardSub>
        </div>
      </CardHeader>
      <LineChart
        labels={series.labels}
        datasets={[
          { label: 'New farmers', data: series.counts, color: palette.purple, fill: true },
        ]}
        height={240}
        showLegend={false}
        ariaLabel={`Sign-ups ${UNIT_LABEL[series.unit]}, ${rangeLabel.toLowerCase()}: ${total} in total`}
      />
    </Card>
  );
}
