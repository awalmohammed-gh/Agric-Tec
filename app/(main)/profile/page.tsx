import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Profile' };

export default function ProfilePage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 14"
        description="Your farmer identity, farm details and verification status."
      />
    </Card>
  );
}
