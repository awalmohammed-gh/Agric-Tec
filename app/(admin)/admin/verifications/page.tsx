import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Verifications' };

/** Guarded by verifications.review. Built in phase A9. */
export default function VerificationsPage() {
  return (
    <AdminPlaceholder
      permission="verifications.review"
      phase="A9"
      features={[
        'The queue of pending Ghana Card checks',
        'Approve, or reject with a reason the farmer sees',
        'History of reviewed checks',
      ]}
    />
  );
}
