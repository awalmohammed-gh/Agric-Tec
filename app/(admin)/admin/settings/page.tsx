import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'System Settings' };

/** Guarded by settings.manage. Built in phase A14. */
export default function SettingsPage() {
  return (
    <AdminPlaceholder
      permission="settings.manage"
      phase="A14"
      features={['Feature flags and maintenance mode', 'Plans, backups and “Reset demo data”']}
    />
  );
}
