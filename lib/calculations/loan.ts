import { annualizedNetProfit } from '@/lib/calculations/finance';
import { formatGHS } from '@/lib/format';
import type {
  EligibilityIssue,
  EligibilityResult,
  FarmRecord,
  LoanPartner,
  RepaymentResult,
} from '@/types';

const DEFAULT_MIN_SCORE = 550;
const MIN_RECORDS = 5;
const PROFIT_MULTIPLE = 3;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Standard amortized repayment: equal monthly payments covering principal and interest. */
export function monthlyRepayment(
  principal: number,
  annualRatePct: number,
  months: number,
): RepaymentResult {
  if (principal <= 0 || months <= 0) return { monthly: 0, total: 0, interest: 0 };

  const r = annualRatePct / 100 / 12;
  const monthly = r === 0 ? principal / months : (principal * r) / (1 - Math.pow(1 + r, -months));
  const total = monthly * months;
  return {
    monthly: round2(monthly),
    total: round2(total),
    interest: round2(total - principal),
  };
}

/** Checks every eligibility rule and collects ALL failing reasons, not just the first. */
export function checkEligibility({
  amount,
  records,
  score,
  partner,
}: {
  amount: number;
  records: FarmRecord[];
  score: number;
  partner?: LoanPartner;
}): EligibilityResult {
  const issues: EligibilityIssue[] = [];
  const maxAffordable = Math.max(0, PROFIT_MULTIPLE * annualizedNetProfit(records));
  const minScore = partner?.minScore ?? DEFAULT_MIN_SCORE;

  if (records.length < MIN_RECORDS) {
    issues.push({
      code: 'records',
      message: `You need at least ${MIN_RECORDS} farm records (you have ${records.length}).`,
    });
  }
  if (amount > maxAffordable) {
    issues.push({
      code: 'affordability',
      message: `Requested amount is above 3× your yearly profit (max ${formatGHS(maxAffordable)}).`,
    });
  }
  if (score < minScore) {
    issues.push({
      code: 'score',
      message: `Credit score must be at least ${minScore} (yours is ${score}).`,
    });
  }
  if (partner && amount > partner.maxAmount) {
    issues.push({
      code: 'lender-max',
      message: `Above this lender's maximum of ${formatGHS(partner.maxAmount)}.`,
    });
  }

  return {
    eligible: issues.length === 0,
    reasons: issues.map((issue) => issue.message),
    issues,
    maxAffordable,
  };
}

/** How well the user's score matches a lender, from 40% to 98%. */
export function matchPercentage(score: number, partner: LoanPartner): number {
  const raw = 70 + (score - partner.minScore) / 5;
  return Math.round(Math.min(98, Math.max(40, raw)));
}
