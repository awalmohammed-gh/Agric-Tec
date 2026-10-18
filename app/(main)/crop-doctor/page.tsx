import type { Metadata } from 'next';
import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

export const metadata: Metadata = { title: 'AI Crop Doctor' };

export default function CropDoctorPage() {
  return (
    <Card>
      <EmptyState
        icon={Construction}
        title="Coming in Phase 12"
        description="Upload a crop photo to detect diseases and get treatment advice."
      />
    </Card>
  );
}
