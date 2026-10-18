import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'AI Assistant' };

export default function AssistantPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 11"
        description="Chat with the AgriCtec assistant about farming, finance and loans."
      />
    </Card>
  );
}
