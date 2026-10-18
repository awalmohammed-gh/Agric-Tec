import type { Metadata } from 'next';
import { ApplyConfirmModal } from '@/components/loans/apply-confirm-modal';
import { CreditProfileCard } from '@/components/loans/credit-profile-card';
import { LoanApplicationForm } from '@/components/loans/loan-application-form';
import { LoansBanner } from '@/components/loans/loans-banner';
import { PartnerOffers } from '@/components/loans/partner-offers';

export const metadata: Metadata = { title: 'Loans & Credit' };

/** `@container`: the two-column layout responds to the content width, not the window. */
export default function LoansPage() {
  return (
    <div className="@container space-y-6">
      <LoansBanner />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <CreditProfileCard />
        <LoanApplicationForm />
      </div>
      <PartnerOffers />
      <ApplyConfirmModal />
    </div>
  );
}
