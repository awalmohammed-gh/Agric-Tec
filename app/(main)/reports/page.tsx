import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Financial Reports' };

export default function ReportsPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 9"
        description="Profit and loss, financial health and downloadable PDF reports."
      />
    </Card>
  );
}
