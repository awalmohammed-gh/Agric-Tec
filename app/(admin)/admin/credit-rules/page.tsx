import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Credit Rules' };

/** Guarded by credit.configure. Built in phase A11. */
export default function CreditRulesPage() {
  return (
    <AdminPlaceholder
      permission="credit.configure"
      phase="A11"
      features={[
        'Edit score weights, targets, bands and loan eligibility',
        'A simulator showing how farmers’ scores would change',
        'Version history with restore',
      ]}
    />
  );
}
