import type { Metadata } from 'next';
import { ApplyConfirmModal } from '@/components/loans/apply-confirm-modal';
import { CreditProfileCard } from '@/components/loans/credit-profile-card';
import { LoanApplicationForm } from '@/components/loans/loan-application-form';
import { LoanJourney } from '@/components/loans/loan-journey';
import { LoansHero } from '@/components/loans/loans-hero';
import { MyApplications } from '@/components/loans/my-applications';
import { PartnerOffers } from '@/components/loans/partner-offers';

export const metadata: Metadata = { title: 'Loans & Credit' };

/**
 * Loan hub. `@container`: the layout responds to the content width (which depends on the
 * sidebar): one column on phones, the builder plus a 360px side column when wide.
 */
export default function LoansPage() {
  return (
    <div className="@container space-y-6">
      <LoansHero />
      <LoanJourney />
      <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-[minmax(0,1fr)_360px]">
        <LoanApplicationForm />
        <div className="space-y-6">
          <CreditProfileCard />
          <MyApplications />
        </div>
      </div>
      <PartnerOffers />
      <ApplyConfirmModal />
    </div>
  );
}
