import type { Metadata } from 'next';
import { ApplyConfirmModal } from '@/components/loans/apply-confirm-modal';
import { LoansHero } from '@/components/loans/loans-hero';
import { LoanWorkspace } from '@/components/loans/loan-workspace';

export const metadata: Metadata = { title: 'Loans & Credit' };

/**
 * Loan hub: credit summary on top, then tabs for building a loan, the credit score and
 * applications. `@container`: layouts respond to the content width, not the window.
 */
export default function LoansPage() {
  return (
    <div className="@container space-y-6">
      <LoansHero />
      <LoanWorkspace />
      <ApplyConfirmModal />
    </div>
  );
}
