import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 7"
        description="AI insights, income and expense stats, loan readiness and recent activity."
      />
    </Card>
  );
}
