import type { Metadata } from 'next';
import { AnnualTrendChart } from '@/components/reports/annual-trend-chart';
import { HealthCard } from '@/components/reports/health-card';
import { PnlSummaryCard } from '@/components/reports/pnl-summary-card';
import { ReportCardsGrid } from '@/components/reports/report-cards-grid';
import { ReportPreviewModal } from '@/components/reports/report-preview-modal';
import { ReportsBanner } from '@/components/reports/reports-banner';

export const metadata: Metadata = { title: 'Financial Reports' };

export default function ReportsPage() {
  return (
    <div className="@container space-y-6">
      <ReportsBanner />
      <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
        <PnlSummaryCard />
        <HealthCard />
      </div>
      <ReportCardsGrid />
      <AnnualTrendChart />
      <ReportPreviewModal />
    </div>
  );
}
