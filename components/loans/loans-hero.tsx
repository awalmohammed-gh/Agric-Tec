'use client';

import {
  BadgePercent,
  Building2,
  Calculator,
  Gauge,
  ListChecks,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { ScoreGauge } from '@/components/ui/score-gauge';
import { LOAN_PARTNERS } from '@/constants/loan-partners';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useLoanStore, type LoanTab } from '@/store/loan-store';

function status(score: number): { label: string; tone: string } {
  if (score >= 650)
    return { label: 'Loan ready', tone: 'border-accent/40 bg-accent/15 text-ink-green' };
  if (score >= 550)
    return { label: 'Eligible with some lenders', tone: 'border-gold/40 bg-gold/15 text-ink-gold' };
  return { label: 'Building credit', tone: 'border-danger/40 bg-danger/15 text-ink-red' };
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="border-border bg-glass flex items-center gap-3 rounded-2xl border px-3.5 py-3">
      <span className="bg-accent/15 text-ink-green inline-flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-text-mute text-[11px]">{label}</p>
        <p className="text-text truncate text-sm font-bold">{value}</p>
      </div>
    </div>
  );
}

/** Borrowing power as the headline, with the credit gauge and key lending facts. */
export function LoansHero() {
  const { credit, creditLabel, annualizedProfit, recordCount } = useFarmStats();
  const maxAffordable = Math.max(0, 3 * annualizedProfit);
  const matched = LOAN_PARTNERS.filter((p) => credit.score >= p.minScore).length;
  const best = LOAN_PARTNERS.reduce((low, p) => (p.rate < low.rate ? p : low));
  const { label, tone } = status(credit.score);
  const setTab = useLoanStore((s) => s.setTab);

  /** Opens a tab of the loan workspace and brings it into view. */
  function openTab(tab: LoanTab) {
    setTab(tab);
    document
      .getElementById('loan-workspace')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section
      aria-labelledby="loans-hero-title"
      className="border-border bg-glass shadow-glass @container relative overflow-hidden rounded-3xl border p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -right-20 size-96 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.22),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -left-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.16),transparent_70%)]"
      />

      <div className="relative grid items-center gap-8 @3xl:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="border-purple/30 bg-purple/10 text-ink-purple inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
              <Sparkles size={13} aria-hidden="true" /> AI Loan Matching
            </span>
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', tone)}>
              {label}
            </span>
          </div>

          <p className="text-text-dim mt-5 text-sm font-semibold">Your borrowing power</p>
          <h2
            id="loans-hero-title"
            className={cn(
              'font-display text-4xl leading-tight font-bold @xl:text-5xl',
              maxAffordable > 0 ? 'text-gradient-brand' : 'text-text',
            )}
          >
            {maxAffordable > 0 ? formatGHS(maxAffordable) : 'Not unlocked yet'}
          </h2>
          <p className="text-text-dim mt-2 max-w-xl text-sm">
            {maxAffordable > 0
              ? `Up to 3× your annualized profit of ${formatGHS(annualizedProfit)}. Lenders still set the final amount.`
              : 'Record profitable sales and your borrowing limit will appear here.'}
          </p>

          <div className="mt-6 flex flex-col gap-3 @md:flex-row">
            <button
              type="button"
              onClick={() => openTab('apply')}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-br from-[#34d399] to-[#10b981] px-5 text-sm font-semibold text-[#022c22] shadow-[0_8px_24px_-6px_var(--accent-glow)] transition-transform hover:-translate-y-0.5"
            >
              <Calculator size={16} aria-hidden="true" /> Build my loan
            </button>
            <button
              type="button"
              onClick={() => openTab('credit')}
              className="glass text-text hover:bg-glass-strong inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors"
            >
              <Gauge size={16} aria-hidden="true" /> See my credit score
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 @lg:grid-cols-3">
            <Stat
              icon={Building2}
              label="Lenders matched"
              value={`${matched} of ${LOAN_PARTNERS.length}`}
            />
            <Stat
              icon={BadgePercent}
              label="Best rate"
              value={`${best.rate}% · ${best.name.split(' ')[0]}`}
            />
            <Stat icon={ListChecks} label="Farm records" value={String(recordCount)} />
          </div>
        </div>

        <div className="flex flex-col items-center">
          <ScoreGauge
            value={credit.score}
            min={300}
            max={850}
            label="Credit score"
            caption={creditLabel}
          />
          <p className="text-text-mute mt-2 text-xs">Scores range from 300 to 850</p>
        </div>
      </div>
    </section>
  );
}
