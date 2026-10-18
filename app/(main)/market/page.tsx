import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Market & Weather' };

export default function MarketPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 13"
        description="Crop prices, price trends and the local weather advisory."
      />
    </Card>
  );
}
