import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Audit Log' };

/** Guarded by audit.view. Built in phase A14. */
export default function AuditLogPage() {
  return (
    <AdminPlaceholder
      permission="audit.view"
      phase="A14"
      features={['Every admin action with before → after', 'Filters and JSON export']}
    />
  );
}
