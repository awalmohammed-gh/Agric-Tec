import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Reports & Analytics' };

/** Guarded by reports.export. Built in phase A14. */
export default function ReportsPage() {
  return (
    <AdminPlaceholder
      permission="reports.export"
      phase="A14"
      features={['Platform-wide analytics', 'CSV exports']}
    />
  );
}
