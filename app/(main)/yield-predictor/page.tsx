import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'AI Yield Predictor' };

export default function YieldPredictorPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 12"
        description="Estimate your harvest range and expected revenue."
      />
    </Card>
  );
}
