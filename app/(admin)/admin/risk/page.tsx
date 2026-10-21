import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Risk & Fraud' };

/** Guarded by risk.review. Built in phase A13. */
export default function RiskPage() {
  return (
    <AdminPlaceholder
      permission="risk.review"
      phase="A13"
      features={[
        'The detection rules and their thresholds',
        'Run a scan; review, dismiss or confirm flags with a note',
      ]}
    />
  );
}
