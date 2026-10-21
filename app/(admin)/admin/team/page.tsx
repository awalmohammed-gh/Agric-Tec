import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Team & Roles' };

/** Guarded by admins.manage. Built in phase A14. */
export default function TeamPage() {
  return (
    <AdminPlaceholder
      permission="admins.manage"
      phase="A14"
      features={[
        'Invite staff, change roles, disable and reset passwords',
        'The role permission matrix',
      ]}
    />
  );
}
