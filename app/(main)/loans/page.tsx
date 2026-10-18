import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Loans & Credit' };

export default function LoansPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 10"
        description="Your credit profile, eligibility check and lender offers."
      />
    </Card>
  );
}
