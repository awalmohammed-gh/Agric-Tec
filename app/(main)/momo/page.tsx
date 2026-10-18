import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'MoMo Transactions' };

export default function MomoPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 8"
        description="Log mobile money payments and see inflows versus outflows."
      />
    </Card>
  );
}
