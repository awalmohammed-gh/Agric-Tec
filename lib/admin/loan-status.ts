import type { LoanStatus } from '@/types/admin';

/** In pipeline order. */
export const LOAN_STATUSES: readonly LoanStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'disbursed',
  'repaid',
  'defaulted',
];

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
  repaid: 'Repaid',
  defaulted: 'Defaulted',
};

/** The only allowed moves. Rejected, repaid and defaulted are final. */
export const LOAN_TRANSITIONS: Record<LoanStatus, readonly LoanStatus[]> = {
  submitted: ['under_review', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  disbursed: ['repaid', 'defaulted'],
  rejected: [],
  repaid: [],
  defaulted: [],
};

export const canTransition = (from: LoanStatus, to: LoanStatus): boolean =>
  LOAN_TRANSITIONS[from].includes(to);

/** Still in progress: a lender with any of these cannot be removed. */
export const OPEN_LOAN_STATUSES: readonly LoanStatus[] = [
  'submitted',
  'under_review',
  'approved',
  'disbursed',
];

/** Counted as approved by the lender, whatever happened after. */
export const APPROVED_LOAN_STATUSES: readonly LoanStatus[] = [
  'approved',
  'disbursed',
  'repaid',
  'defaulted',
];
