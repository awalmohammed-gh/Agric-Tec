import type { Metadata } from 'next';
import { AiRecommendations } from '@/components/dashboard/ai-recommendations';
import { IncomeExpenseChart } from '@/components/dashboard/income-expense-chart';
import { InsightBanner } from '@/components/dashboard/insight-banner';
import { LoanReadinessCard } from '@/components/dashboard/loan-readiness-card';
import { QuickActions } from '@/components/dashboard/quick-actions';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { SampleDataPrompt } from '@/components/dashboard/sample-data-prompt';
import { StatsRow } from '@/components/dashboard/stats-row';

export const metadata: Metadata = { title: 'Dashboard' };

/** Server Component: only arranges the client components. */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <SampleDataPrompt />
      <InsightBanner />
      <StatsRow />
      {/* Two columns above 1024px, stacked at 1024px and below. */}
      <div className="grid grid-cols-1 gap-6 min-[1025px]:grid-cols-[2fr_1fr]">
        <IncomeExpenseChart />
        <LoanReadinessCard />
      </div>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <QuickActions />
        <RecentActivity />
      </div>
      <AiRecommendations />
    </div>
  );
}
