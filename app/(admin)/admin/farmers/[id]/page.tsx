import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Farmer profile' };

/** Guarded by farmers.view. Built in phase A8. */
export default async function FarmerDetailPage({ params }: PageProps<'/admin/farmers/[id]'>) {
  const { id } = await params;
  return (
    <AdminPlaceholder
      permission="farmers.view"
      phase="A8"
      title="Farmer profile"
      features={[
        `Farmer ID: ${id}`,
        ...[
          'Full profile, records, MoMo, score breakdown and history',
          'Suspend, reactivate, verify, reset password and delete',
          'Admin notes, tags and read-only “view as farmer”',
        ],
      ]}
    />
  );
}
