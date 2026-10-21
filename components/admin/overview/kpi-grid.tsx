'use client';

import {
  BadgeCheck,
  ClipboardList,
  Gauge,
  Percent,
  ShieldAlert,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { KpiCard, type KpiCardProps } from '@/components/admin/shared/kpi-card';
import { useAdminRole } from '@/hooks/admin/use-can';
import { scoreLabel } from '@/lib/calculations/credit-score';
import { DATE_RANGES, overviewKpis, type DateRange } from '@/lib/admin/overview';
import { can } from '@/lib/admin/permissions';
import { formatCompactGHS } from '@/lib/format';
import { useAdminDataStore } from '@/store/admin/admin-data-store';
import type { CreditConfig, Permission } from '@/types/admin';

interface Kpi {
  key: string;
  card: KpiCardProps;
  /** The KPI only shows when the role can load its data. */
  needs: Permission;
  /** Its link only shows when the role can open the page. */
  linkNeeds?: Permission;
}

/** Eight platform KPIs. Deltas compare the chosen range with the period just before it. */
export function KpiGrid({ range, bands }: { range: DateRange; bands?: CreditConfig['bands'] }) {
  const role = useAdminRole();
  const farmers = useAdminDataStore((s) => s.farmers);
  const applications = useAdminDataStore((s) => s.applications);
  const riskFlags = useAdminDataStore((s) => s.riskFlags);
  const verifications = useAdminDataStore((s) => s.verifications);
  const k = overviewKpis(farmers, applications, riskFlags, verifications, range);
  const rangeLabel = DATE_RANGES.find((r) => r.value === range)?.short ?? '';
  const deltaLabel = range === 'all' ? '' : 'vs previous period';

  const kpis: Kpi[] = [
    {
      key: 'farmers',
      needs: 'farmers.view',
      linkNeeds: 'farmers.view',
      card: {
        label: 'Total Farmers',
        icon: Users,
        value: k.totalFarmers.toLocaleString(),
        hint: `+${k.newInRange} ${rangeLabel}`,
        delta: k.newDelta,
        deltaLabel,
        trend: k.farmersTrend,
        href: '/admin/farmers',
        linkLabel: 'All farmers',
      },
    },
    {
      key: 'active',
      needs: 'farmers.view',
      linkNeeds: 'farmers.view',
      card: {
        label: 'Active (30 days)',
        icon: UserCheck,
        value: k.active30.toLocaleString(),
        hint: `${k.activeShare}% of farmers`,
        href: '/admin/farmers?active=30',
        linkLabel: 'Active farmers',
      },
    },
    {
      key: 'score',
      needs: 'farmers.view',
      linkNeeds: 'credit.configure',
      card: {
        label: 'Avg Credit Score',
        icon: Gauge,
        value: String(k.averageScore),
        hint: k.totalFarmers ? scoreLabel(k.averageScore, bands) : 'No farmers yet',
        href: '/admin/credit-rules',
        linkLabel: 'Credit rules',
      },
    },
    {
      key: 'income',
      needs: 'farmers.view',
      linkNeeds: 'reports.export',
      card: {
        label: 'Income Tracked',
        icon: Wallet,
        value: formatCompactGHS(k.incomeTracked),
        hint: `by ${k.earningFarmers} farmer${k.earningFarmers === 1 ? '' : 's'}, all time`,
        href: '/admin/reports',
        linkLabel: 'Reports',
      },
    },
    {
      key: 'loans',
      needs: 'loans.view',
      linkNeeds: 'loans.view',
      card: {
        label: 'Loan Requests',
        icon: ClipboardList,
        value: formatCompactGHS(k.loanRequested),
        hint: `${k.loanCount} application${k.loanCount === 1 ? '' : 's'} ${rangeLabel}`,
        delta: k.loanDelta,
        deltaLabel,
        trend: k.loanTrend,
        href: '/admin/loans',
        linkLabel: 'Applications',
      },
    },
    {
      key: 'approval',
      needs: 'loans.view',
      linkNeeds: 'loans.view',
      card: {
        label: 'Approval Rate',
        icon: Percent,
        value: k.approvalRate === null ? '—' : `${k.approvalRate}%`,
        hint: k.decidedCount
          ? `${k.approvedCount} of ${k.decidedCount} decided ${rangeLabel}`
          : `None decided ${rangeLabel}`,
        href: '/admin/loans?status=approved',
        linkLabel: 'Approved',
      },
    },
    {
      key: 'verifications',
      needs: 'verifications.review',
      linkNeeds: 'verifications.review',
      card: {
        label: 'Pending Verifications',
        icon: BadgeCheck,
        value: String(k.pendingVerifications),
        hint:
          k.oldestPendingDays === null
            ? 'Queue is clear'
            : `Oldest waiting ${k.oldestPendingDays} day${k.oldestPendingDays === 1 ? '' : 's'}`,
        href: '/admin/verifications',
        linkLabel: 'Review queue',
      },
    },
    {
      key: 'risk',
      needs: 'risk.review',
      linkNeeds: 'risk.review',
      card: {
        label: 'Open Risk Flags',
        icon: ShieldAlert,
        value: String(k.openFlags),
        hint: `${k.openHighFlags} high`,
        lowerIsBetter: true,
        href: '/admin/risk',
        linkLabel: 'Review flags',
      },
    },
  ];

  const visible = kpis.filter((kpi) => can(role, kpi.needs));

  return (
    <section
      aria-label="Key figures"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {visible.map(({ key, card, linkNeeds }) => (
        <KpiCard
          key={key}
          {...card}
          href={linkNeeds && can(role, linkNeeds) ? card.href : undefined}
        />
      ))}
    </section>
  );
}
