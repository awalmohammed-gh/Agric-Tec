import type { Metadata } from 'next';
import { AdminPlaceholder } from '@/components/admin/layout/admin-placeholder';

export const metadata: Metadata = { title: 'Loan application' };

/** Guarded by loans.view. Built in phase A10. */
export default async function LoanDetailPage({ params }: PageProps<'/admin/loans/[id]'>) {
  const { id } = await params;
  return (
    <AdminPlaceholder
      permission="loans.view"
      phase="A10"
      title="Loan application"
      features={[
        `Application ID: ${id}`,
        ...[
          'The application, the farmer’s score then and now',
          'Status timeline and the allowed next steps',
        ],
      ]}
    />
  );
}
