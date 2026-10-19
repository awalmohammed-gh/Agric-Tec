'use client';

import { CreditProfileCard } from '@/components/loans/credit-profile-card';
import { LoanApplicationForm } from '@/components/loans/loan-application-form';
import { LoanJourney } from '@/components/loans/loan-journey';
import { MyApplications } from '@/components/loans/my-applications';
import { ScoreLadder } from '@/components/loans/score-ladder';
import { Tabs } from '@/components/ui/tabs';
import { useLoanStore, type LoanTab } from '@/store/loan-store';

const ID = 'loan-workspace';

/**
 * The three jobs on this page as tabs: build a loan, understand the credit score, track
 * applications. Panels stay mounted (only hidden), so the loan being built survives a tab
 * switch.
 */
export function LoanWorkspace() {
  const tab = useLoanStore((s) => s.tab);
  const setTab = useLoanStore((s) => s.setTab);
  const applications = useLoanStore((s) => s.applications);

  const panel = (value: LoanTab) => ({
    id: `${ID}-panel-${value}`,
    role: 'tabpanel' as const,
    'aria-labelledby': `${ID}-tab-${value}`,
    hidden: tab !== value,
  });

  return (
    <section id={ID} aria-label="Loan workspace" className="scroll-mt-28 space-y-5">
      <Tabs
        label="Loans and credit"
        idPrefix={ID}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'apply', label: 'Get a loan' },
          { value: 'credit', label: 'Credit score' },
          { value: 'applications', label: 'Applications', count: applications.length },
        ]}
      />

      <div {...panel('apply')}>
        <LoanApplicationForm />
      </div>

      <div {...panel('credit')} className="space-y-6">
        <LoanJourney />
        <div className="grid grid-cols-1 items-start gap-6 @4xl:grid-cols-2">
          <CreditProfileCard />
          <ScoreLadder />
        </div>
      </div>

      <div {...panel('applications')}>
        <MyApplications />
      </div>
    </section>
  );
}
