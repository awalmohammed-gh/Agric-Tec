'use client';

import {
  Banknote,
  CalendarRange,
  CircleCheck,
  Landmark,
  Percent,
  Send,
  TriangleAlert,
} from 'lucide-react';
import { draftForPartner } from '@/components/loans/loan-schema';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { matchPercentage, monthlyRepayment } from '@/lib/calculations/loan';
import { formatGHS } from '@/lib/format';
import { useLoanStore } from '@/store/loan-store';

function matchColor(match: number): BadgeColor {
  if (match >= 80) return 'green';
  if (match >= 60) return 'gold';
  return 'red';
}

/** Lender cards, best match first. Only the "Apply Now" button applies. */
export function PartnerOffers() {
  const { credit, annualizedProfit } = useFarmStats();
  const lastDraft = useLoanStore((s) => s.lastDraft);
  const openConfirm = useLoanStore((s) => s.openConfirm);
  const maxAffordable = Math.max(0, 3 * annualizedProfit);

  const offers = LOAN_PARTNERS.map((partner) => ({
    partner,
    match: matchPercentage(credit.score, partner),
  })).sort((a, b) => b.match - a.match);

  return (
    <Card className="@container">
      <CardHeader>
        <div>
          <CardTitle>Partner Financial Institutions</CardTitle>
          <CardSub>Matched to your credit profile</CardSub>
        </div>
      </CardHeader>

      <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
        {offers.map(({ partner, match }) => {
          const gap = partner.minScore - credit.score;
          const qualifies = gap <= 0;
          const draft = draftForPartner(partner, lastDraft, maxAffordable);
          const estimate = monthlyRepayment(draft.amount, partner.rate, draft.months);
          return (
            <li
              key={partner.id}
              className="border-border bg-glass flex flex-col rounded-2xl border p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className="inline-flex size-12 items-center justify-center rounded-2xl text-white shadow-lg"
                  style={{ backgroundColor: partner.color }}
                >
                  <Landmark size={22} aria-hidden="true" />
                </span>
                <Badge color={matchColor(match)}>{match}% match</Badge>
              </div>

              <h3 className="text-text mt-4 font-bold">{partner.name}</h3>

              <dl className="mt-3 space-y-2 text-sm">
                <div className="text-text-dim flex items-center gap-2">
                  <Percent size={14} aria-hidden="true" className="text-text-mute shrink-0" />
                  <dt className="sr-only">Interest</dt>
                  <dd>
                    Interest: <strong className="text-text">{partner.rate}% p.a.</strong>
                  </dd>
                </div>
                <div className="text-text-dim flex items-center gap-2">
                  <Banknote size={14} aria-hidden="true" className="text-text-mute shrink-0" />
                  <dt className="sr-only">Maximum</dt>
                  <dd>
                    Up to <strong className="text-text">{formatGHS(partner.maxAmount)}</strong>
                  </dd>
                </div>
                <div className="text-text-dim flex items-center gap-2">
                  <CalendarRange size={14} aria-hidden="true" className="text-text-mute shrink-0" />
                  <dt className="sr-only">Term</dt>
                  <dd>
                    {partner.minMonths}–{partner.maxMonths} months
                  </dd>
                </div>
              </dl>

              <div className="border-border bg-glass mt-4 rounded-xl border px-3 py-2.5 text-sm">
                <p className="text-text-dim">
                  Min. score: <strong className="text-text">{partner.minScore}</strong>
                </p>
                {qualifies ? (
                  <p className="text-ink-green mt-0.5 flex items-center gap-1.5 font-semibold">
                    <CircleCheck size={14} aria-hidden="true" /> You qualify
                  </p>
                ) : (
                  <p className="text-ink-red mt-0.5 flex items-center gap-1.5 font-semibold">
                    <TriangleAlert size={14} aria-hidden="true" /> Need {gap} more points
                  </p>
                )}
              </div>

              <p className="text-text-mute mt-3 text-xs">
                Est. {formatGHS(estimate.monthly)}/month for {formatGHS(draft.amount)} over{' '}
                {draft.months} months
              </p>

              <Button
                icon={Send}
                variant={qualifies ? 'primary' : 'ghost'}
                className="mt-4 w-full"
                onClick={() => openConfirm(draft)}
              >
                Apply Now
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
