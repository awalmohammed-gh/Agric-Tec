import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Loan Applications' };

/** Guarded by loans.view. Built in phase A10. */
export default function LoansPage() {
  return (
    <AdminPlaceholder
      permission="loans.view"
      phase="A10"
      features={[
        'The application pipeline by status',
        'Move applications through review, approval and repayment',
      ]}
    />
  );
}
