'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/admin/layout/page-header';
import { CropPopularityChart } from '@/components/admin/overview/crop-popularity-chart';
import { KpiGrid } from '@/components/admin/overview/kpi-grid';
import { LoanFunnel } from '@/components/admin/overview/loan-funnel';
import { NeedsAttention } from '@/components/admin/overview/needs-attention';
import { RecentAdminActivity } from '@/components/admin/overview/recent-admin-activity';
import { RegionChart } from '@/components/admin/overview/region-chart';
import { ScoreDistributionChart } from '@/components/admin/overview/score-distribution-chart';
import { SignupsChart } from '@/components/admin/overview/signups-chart';
import { SystemStatus } from '@/components/admin/overview/system-status';
import { Select } from '@/components/ui/select';
import { useCan } from '@/hooks/admin/use-can';
import { usePlatformStatus } from '@/hooks/admin/use-platform-status';
import { DATE_RANGES, type DateRange } from '@/lib/admin/overview';
import { useAdminAuthStore } from '@/store/admin/admin-auth-store';

/**
 * KPIs → needs attention + system status → 2×2 charts → loan funnel → recent activity.
 * The range changes the KPI deltas, the sign-ups chart and the funnel; the region, score and
 * crop charts always describe all farmers today.
 */
export function AdminOverview() {
  const [range, setRange] = useState<DateRange>('12m');
  const status = usePlatformStatus();
  const name = useAdminAuthStore((s) => s.admin?.name.split(' ')[0]);
  const canFarmers = useCan('farmers.view');
  const canLoans = useCan('loans.view');
  const bands = status?.creditConfig.bands;

  return (
    <div className="space-y-6">
      <PageHeader
        title={name ? `Welcome back, ${name}` : 'Overview'}
        description="The health of the whole platform, and what needs attention now."
        actions={
          <label className="flex items-center gap-2 text-sm">
            <span className="text-text-dim">Period</span>
            <Select
              value={range}
              onChange={(event) => setRange(event.target.value as DateRange)}
              className="min-w-40"
            >
              {DATE_RANGES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        }
        className="mb-0"
      />

      <KpiGrid range={range} bands={bands} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <NeedsAttention flags={status?.flags ?? null} />
        <SystemStatus status={status} />
      </div>

      {canFarmers && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <SignupsChart range={range} />
          <RegionChart />
          <ScoreDistributionChart bands={bands} />
          <CropPopularityChart />
        </div>
      )}

      {canLoans && <LoanFunnel range={range} />}

      <RecentAdminActivity />
    </div>
  );
}
