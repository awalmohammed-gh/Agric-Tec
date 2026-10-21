import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Market & Weather' };

/** Guarded by content.manage. Built in phase A12. */
export default function MarketContentPage() {
  return (
    <AdminPlaceholder
      permission="content.manage"
      phase="A12"
      features={['Edit crop prices', 'Set or clear a weather override']}
    />
  );
}
