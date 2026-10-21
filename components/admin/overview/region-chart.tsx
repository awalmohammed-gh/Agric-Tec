'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BarChart } from '@/components/charts/bar-chart';
import { useChartTheme } from '@/components/charts/use-chart-theme';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { farmersByRegion } from '@/lib/admin/analytics';
import { regionHref } from '@/lib/admin/overview';
import { useAdminDataStore } from '@/store/admin/admin-data-store';

/** Farmers in all 16 regions, most first. Clicking a bar opens the farmers list for that region. */
export function RegionChart() {
  const router = useRouter();
  const farmers = useAdminDataStore((s) => s.farmers);
  const { palette } = useChartTheme();
  const regions = farmersByRegion(farmers);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Farmers by region</CardTitle>
          <CardSub>All farmers · click a bar to see that region</CardSub>
        </div>
      </CardHeader>
      <BarChart
        horizontal
        labels={regions.map((r) => r.region)}
        datasets={[{ label: 'Farmers', data: regions.map((r) => r.count), color: palette.purple }]}
        height={420}
        showLegend={false}
        onBarClick={(index) => router.push(regionHref(regions[index].region))}
        ariaLabel={`Farmers by region: ${regions.map((r) => `${r.region} ${r.count}`).join(', ')}`}
      />
      {/* The canvas can't be focused, so keyboard and screen-reader users get the same links. */}
      <ul className="sr-only" aria-label="Open the farmers list for a region">
        {regions.map((r) => (
          <li key={r.region}>
            <Link href={regionHref(r.region)}>
              {r.region}: {r.count} farmers
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
