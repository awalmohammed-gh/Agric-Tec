import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'All Farmers' };

/** Guarded by farmers.view. Built in phase A7. */
export default function FarmersPage() {
  return (
    <AdminPlaceholder
      permission="farmers.view"
      phase="A7"
      features={[
        'Search by name, email or phone; filter by region, status, crop and tags',
        'Bulk suspend, verify and tag; CSV export',
        'Sortable table with 25 per page',
      ]}
    />
  );
}
