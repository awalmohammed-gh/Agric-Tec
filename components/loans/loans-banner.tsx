'use client';

import { BadgeCheck, Building2, Gauge, Sparkles, Wallet } from 'lucide-react';
import { AiBanner } from '@/components/ui/ai-banner';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';

/** "AI Loan Matching" banner with the farmer's key borrowing facts. */
export function LoansBanner() {
  const { credit, creditLabel, annualizedProfit } = useFarmStats();
  const maxAffordable = Math.max(0, 3 * annualizedProfit);
  const qualifying = LOAN_PARTNERS.filter((p) => credit.score >= p.minScore).length;

  const facts = [
    { icon: Gauge, text: `Score ${credit.score} · ${creditLabel}` },
    {
      icon: Wallet,
      text: maxAffordable > 0 ? `Up to ${formatGHS(maxAffordable)}` : 'No borrowing limit yet',
    },
    { icon: Building2, text: `${qualifying} of ${LOAN_PARTNERS.length} lenders match your score` },
  ];

  return (
    <AiBanner
      icon={Sparkles}
      title="AI Loan Matching"
      subtitle={
        <>
          We compare your credit profile with partner lenders and show exactly why you qualify, or
          what to fix first.
          <span className="mt-3 flex flex-wrap gap-2">
            {facts.map(({ icon: Icon, text }) => (
              <span
                key={text}
                className="border-border bg-glass text-text-dim inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
              >
                <Icon size={12} aria-hidden="true" /> {text}
              </span>
            ))}
          </span>
        </>
      }
      action={
        <a
          href="#apply"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-linear-to-br from-[#34d399] to-[#10b981] px-5 text-sm font-semibold text-[#022c22] shadow-[0_8px_24px_-6px_var(--accent-glow)] transition-transform hover:-translate-y-0.5"
        >
          <BadgeCheck size={16} aria-hidden="true" /> Check eligibility
        </a>
      }
    />
  );
}
