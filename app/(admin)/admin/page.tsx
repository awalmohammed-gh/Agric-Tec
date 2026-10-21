import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Overview' };

/** Guarded by overview.view. Built in phase A6. */
export default function AdminOverviewPage() {
  return (
    <AdminPlaceholder
      permission="overview.view"
      phase="A6"
      features={[
        'Platform KPIs: farmers, activity, income tracked, credit scores',
        'Sign-ups, regions, score bands and the loan funnel as charts',
        'Queues that need attention, with links',
      ]}
    />
  );
}
