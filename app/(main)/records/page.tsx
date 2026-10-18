import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Farm Records' };

export default function RecordsPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 8"
        description="Add, edit and filter your income, expense and activity records."
      />
    </Card>
  );
}
