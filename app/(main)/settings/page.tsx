import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 14"
        description="Theme, language, notifications and your data."
      />
    </Card>
  );
}
