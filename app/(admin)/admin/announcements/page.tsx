import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Announcements' };

/** Guarded by announcements.send. Built in phase A12. */
export default function AnnouncementsPage() {
  return (
    <AdminPlaceholder
      permission="announcements.send"
      phase="A12"
      features={[
        'Create banners for everyone, a region or a crop',
        'Schedule, end and delete announcements',
      ]}
    />
  );
}
