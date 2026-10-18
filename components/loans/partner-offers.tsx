'use client';

import { useState } from 'react';
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
import { cn } from '@/lib/utils';
import { useLoanStore } from '@/store/loan-store';

type SortKey = 'match' | 'payment' | 'rate';

const SORT_LABELS: Record<SortKey, string> = {
  match: 'Best match',
  payment: 'Lowest payment',
  rate: 'Lowest rate',
};

function matchColor(match: number): BadgeColor {
  if (match >= 80) return 'green';
  if (match >= 60) return 'gold';
  return 'red';
}

/**
 * Lender comparison priced for the loan in the builder. Only "Apply Now" applies; the rest of
 * the card is information.
 */
export function PartnerOffers() {
  const { credit, annualizedProfit } = useFarmStats();
  const lastDraft = useLoanStore((s) => s.lastDraft);
  const openConfirm = useLoanStore((s) => s.openConfirm);
  const [sort, setSort] = useState<SortKey>('match');
  const maxAffordable = Math.max(0, 3 * annualizedProfit);

  const offers = LOAN_PARTNERS.map((partner) => {
    const draft = draftForPartner(partner, lastDraft, maxAffordable);
    return {
      partner,
      draft,
      match: matchPercentage(credit.score, partner),
      repayment: monthlyRepayment(draft.amount, partner.rate, draft.months),
      // Does this lender offer the term chosen in the builder?
      offersTerm:
        !lastDraft ||
        (lastDraft.months >= partner.minMonths && lastDraft.months <= partner.maxMonths),
    };
  });

  const bestMatch = Math.max(...offers.map((o) => o.match));
  const lowestRate = Math.min(...offers.map((o) => o.partner.rate));
  const comparable = offers.filter((o) => o.offersTerm);
  const lowestPayment = comparable.length
    ? Math.min(...comparable.map((o) => o.repayment.monthly))
    : null;

  const sorted = [...offers].sort((a, b) => {
    if (sort === 'rate') return a.partner.rate - b.partner.rate;
    if (sort === 'payment') {
      // Lenders that offer the chosen term first, then by payment.
      if (a.offersTerm !== b.offersTerm) return a.offersTerm ? -1 : 1;
      return a.repayment.monthly - b.repayment.monthly;
    }
    return b.match - a.match;
  });

  return (
    <Card id="lenders" className="@container scroll-mt-28">
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Partner Financial Institutions</CardTitle>
          <CardSub>
            {lastDraft
              ? `Matched to your credit profile · priced for ${formatGHS(lastDraft.amount)} over ${lastDraft.months} months`
              : 'Matched to your credit profile'}
          </CardSub>
        </div>
        <div
          role="group"
          aria-label="Sort lenders"
          className="border-border bg-glass inline-flex flex-wrap rounded-xl border p-1"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={sort === key}
              onClick={() => setSort(key)}
              className={cn(
                'min-h-9 rounded-lg px-3 text-xs font-semibold transition-colors',
                sort === key ? 'bg-accent/20 text-ink-green' : 'text-text-dim hover:text-text',
              )}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </CardHeader>

      <ul className="grid grid-cols-1 gap-4 @xl:grid-cols-2 @5xl:grid-cols-4">
        {sorted.map(({ partner, draft, match, repayment, offersTerm }) => {
          const gap = partner.minScore - credit.score;
          const qualifies = gap <= 0;
          const selected = lastDraft?.partnerId === partner.id;
          const tags = [
            match === bestMatch && 'Best match',
            partner.rate === lowestRate && 'Lowest rate',
            offersTerm && repayment.monthly === lowestPayment && 'Lowest payment',
          ].filter((t): t is string => Boolean(t));

          return (
            <li
              key={partner.id}
              className={cn(
                'bg-glass relative flex flex-col overflow-hidden rounded-2xl border transition-shadow',
                selected
                  ? 'border-accent/60 shadow-[0_0_0_3px_var(--accent-glow)]'
                  : 'border-border',
              )}
            >
              <div
                aria-hidden="true"
                className="h-1.5"
                style={{ backgroundColor: partner.color }}
              />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="inline-flex size-11 items-center justify-center rounded-2xl text-white shadow-lg"
                    style={{ backgroundColor: partner.color }}
                  >
                    <Landmark size={20} aria-hidden="true" />
                  </span>
                  <Badge color={matchColor(match)}>{match}% match</Badge>
                </div>

                <h3 className="text-text mt-3 font-bold">{partner.name}</h3>
                <div className="mt-1.5 flex min-h-6 flex-wrap gap-1">
                  {selected && (
                    <span className="bg-accent/20 text-ink-green rounded-full px-2 py-0.5 text-[10px] font-bold">
                      Selected
                    </span>
                  )}
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-purple/15 text-ink-purple rounded-full px-2 py-0.5 text-[10px] font-bold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* The figure farmers compare on */}
                <div className="border-border bg-glass mt-3 rounded-xl border px-3.5 py-3">
                  <p className="text-text-mute text-[11px]">Monthly payment</p>
                  <p className="text-text text-2xl font-extrabold tracking-tight tabular-nums">
                    {formatGHS(repayment.monthly)}
                    <span className="text-text-mute text-xs font-semibold"> /mo</span>
                  </p>
                  <p className="text-text-mute text-[11px]">
                    {formatGHS(draft.amount)} over {draft.months} months
                    {!offersTerm && lastDraft && ` (no ${lastDraft.months}-month term)`}
                  </p>
                </div>

                <dl className="mt-3 space-y-1.5 text-sm">
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
                    <CalendarRange
                      size={14}
                      aria-hidden="true"
                      className="text-text-mute shrink-0"
                    />
                    <dt className="sr-only">Term</dt>
                    <dd>
                      {partner.minMonths}–{partner.maxMonths} months
                    </dd>
                  </div>
                </dl>

                <div className="border-border mt-3 flex items-center justify-between gap-2 border-t pt-3 text-sm">
                  <span className="text-text-dim">
                    Min. score <strong className="text-text">{partner.minScore}</strong>
                  </span>
                  {qualifies ? (
                    <span className="text-ink-green flex items-center gap-1 text-xs font-semibold">
                      <CircleCheck size={14} aria-hidden="true" /> You qualify
                    </span>
                  ) : (
                    <span className="text-ink-red flex items-center gap-1 text-xs font-semibold">
                      <TriangleAlert size={14} aria-hidden="true" /> Need {gap} more
                    </span>
                  )}
                </div>

                <Button
                  icon={Send}
                  variant={qualifies ? 'primary' : 'ghost'}
                  className="mt-4 w-full"
                  onClick={() => openConfirm(draft)}
                >
                  Apply Now
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
