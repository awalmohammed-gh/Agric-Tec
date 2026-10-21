import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Crops & Yields' };

/** Guarded by content.manage. Built in phase A12. */
export default function CropsContentPage() {
  return (
    <AdminPlaceholder
      permission="content.manage"
      phase="A12"
      features={['Edit yields, farm-gate prices and growing tips per crop']}
    />
  );
}
