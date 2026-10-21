import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Lenders' };

/** Guarded by lenders.manage. Built in phase A10. */
export default function LendersPage() {
  return (
    <AdminPlaceholder
      permission="lenders.manage"
      phase="A10"
      features={[
        'Add and edit lending partners: rates, limits, terms and minimum scores',
        'Switch lenders on or off',
      ]}
    />
  );
}
