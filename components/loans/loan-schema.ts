import { z } from 'zod';
import { LOAN_PARTNERS, LOAN_PERIODS, LOAN_PURPOSES } from '@/constants/loan-partners';
import type { LoanDraft } from '@/store/loan-store';
import type { LoanPartner } from '@/types';

export const MIN_LOAN = 500;
export const MAX_LOAN = 500_000;

export const loanSchema = z.object({
  amount: z.coerce
    .number({ error: 'Enter an amount' })
    .min(MIN_LOAN, 'Minimum loan is GHS 500')
    .max(MAX_LOAN, 'Maximum is GHS 500,000'),
  purpose: z.enum(LOAN_PURPOSES, { error: 'Choose a purpose' }),
  months: z.coerce.number().refine((m) => LOAN_PERIODS.includes(m), 'Choose a repayment period'),
  partnerId: z.string().min(1, 'Choose a lender'),
});

export type LoanFormInput = z.input<typeof loanSchema>;
export type LoanFormValues = z.output<typeof loanSchema>;

/** Lenders whose term range includes the chosen period. */
export function lendersForPeriod(months: number): LoanPartner[] {
  return LOAN_PARTNERS.filter((p) => months >= p.minMonths && months <= p.maxMonths);
}

export function findPartner(id: string): LoanPartner | undefined {
  return LOAN_PARTNERS.find((p) => p.id === id);
}

const TYPICAL_AMOUNT = 10_000;
const TYPICAL_MONTHS = 12;

/**
 * A sensible draft when "Apply Now" is clicked on a lender card: reuse the form's last values
 * where they fit this lender; otherwise a typical GHS 10,000 over 12 months (less if the farmer
 * can't afford that, and the lender's nearest term if 12 months isn't offered).
 */
export function draftForPartner(
  partner: LoanPartner,
  lastDraft: LoanDraft | null,
  maxAffordable: number,
): LoanDraft {
  const offers = (m: number) => m >= partner.minMonths && m <= partner.maxMonths;
  const months =
    lastDraft && offers(lastDraft.months)
      ? lastDraft.months
      : offers(TYPICAL_MONTHS)
        ? TYPICAL_MONTHS
        : (LOAN_PERIODS.find(offers) ?? partner.minMonths);

  const affordable = Math.floor(Math.min(maxAffordable, partner.maxAmount) / 100) * 100;
  const fallback = affordable >= MIN_LOAN ? Math.min(TYPICAL_AMOUNT, affordable) : TYPICAL_AMOUNT;
  return {
    partnerId: partner.id,
    months,
    purpose: lastDraft?.purpose ?? LOAN_PURPOSES[0],
    amount: lastDraft?.amount ?? fallback,
  };
}
