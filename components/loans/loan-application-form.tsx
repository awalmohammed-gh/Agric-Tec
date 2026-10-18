'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Droplets,
  LandPlot,
  ShieldCheck,
  Sprout,
  Tractor,
  Warehouse,
  type LucideIcon,
} from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { EligibilityResult } from '@/components/loans/eligibility-result';
import {
  findPartner,
  lendersForPeriod,
  loanSchema,
  MIN_LOAN,
  type LoanFormInput,
  type LoanFormValues,
} from '@/components/loans/loan-schema';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
import { Select } from '@/components/ui/select';
import { LOAN_PERIODS, LOAN_PURPOSES } from '@/constants/loan-partners';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { checkEligibility, monthlyRepayment } from '@/lib/calculations/loan';
import { formatGHS } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useFarmStore } from '@/store/farm-store';
import { useLoanStore } from '@/store/loan-store';
import type { EligibilityResult as Eligibility, LoanPartner, RepaymentResult } from '@/types';

interface CheckResult {
  values: LoanFormValues;
  partner: LoanPartner;
  eligibility: Eligibility;
  repayment: RepaymentResult;
}

const SLIDER_MAX = 200_000; // the largest partner limit
const SLIDER_STEP = 500;
const QUICK_AMOUNTS = [5_000, 10_000, 25_000];

const PURPOSE_ICONS: Record<string, LucideIcon> = {
  'Seeds & Fertilizer': Sprout,
  'Farm Equipment': Tractor,
  'Land Expansion': LandPlot,
  'Irrigation System': Droplets,
  'Storage & Processing': Warehouse,
};

/** Live estimate shown beside the form: updates on every keystroke. */
function LivePreview({
  amount,
  months,
  partner,
  isCheapest,
}: {
  amount: number;
  months: number;
  partner: LoanPartner | undefined;
  isCheapest: boolean;
}) {
  const valid = amount >= MIN_LOAN && partner !== undefined;
  const repayment = valid ? monthlyRepayment(amount, partner.rate, months) : null;
  const interestShare =
    repayment && repayment.total > 0 ? (repayment.interest / repayment.total) * 100 : 0;

  return (
    <aside
      aria-live="polite"
      className="border-accent/30 from-accent/15 via-accent/5 flex flex-col rounded-2xl border bg-linear-to-br to-transparent p-5"
    >
      <p className="text-text-mute text-[11px] font-semibold tracking-wider uppercase">
        Live estimate
      </p>
      <p className="text-text-dim mt-2 text-xs">Monthly payment</p>
      <p className="text-ink-green text-3xl font-extrabold tracking-tight tabular-nums">
        {repayment ? formatGHS(repayment.monthly) : 'GHS –'}
      </p>
      <p className="text-text-mute mt-1 text-xs">
        {!partner
          ? `No lender offers ${months} months`
          : isCheapest
            ? `Lowest rate for ${months} months: ${partner.rate}% (${partner.name})`
            : `${partner.name} at ${partner.rate}% p.a.`}
      </p>

      {repayment && (
        <>
          <div className="my-5 flex flex-col items-center gap-4">
            <div
              aria-hidden="true"
              className="relative size-20 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(var(--gold) ${interestShare}%, var(--accent) 0)`,
              }}
            >
              <div className="bg-bg-2 text-text-dim absolute inset-2 flex items-center justify-center rounded-full text-[10px] font-semibold">
                {Math.round(interestShare)}% int.
              </div>
            </div>
            <dl className="w-full space-y-1 text-xs [&_dd]:whitespace-nowrap">
              <div className="flex justify-between gap-2">
                <dt className="text-text-dim flex items-center gap-1.5">
                  <span className="bg-accent size-2 rounded-full" aria-hidden="true" /> Principal
                </dt>
                <dd className="text-text font-semibold tabular-nums">{formatGHS(amount)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-text-dim flex items-center gap-1.5">
                  <span className="bg-gold size-2 rounded-full" aria-hidden="true" /> Interest
                </dt>
                <dd className="text-text font-semibold tabular-nums">
                  {formatGHS(repayment.interest)}
                </dd>
              </div>
              <div className="border-border flex justify-between gap-2 border-t pt-1">
                <dt className="text-text-dim">Total</dt>
                <dd className="text-text font-bold tabular-nums">{formatGHS(repayment.total)}</dd>
              </div>
            </dl>
          </div>
          <p className="text-text-mute mt-auto text-[11px]">
            Estimates only. The lender sets final terms.
          </p>
        </>
      )}
      {!repayment && partner && (
        <p className="text-text-mute mt-4 text-xs">
          Enter at least {formatGHS(MIN_LOAN)} to see your payment.
        </p>
      )}
    </aside>
  );
}

/** Loan builder: amount slider, purpose chips, term, lender, live estimate and eligibility. */
export function LoanApplicationForm({ className }: { className?: string }) {
  const records = useFarmStore((s) => s.records);
  const { credit, annualizedProfit } = useFarmStats();
  const setLastDraft = useLoanStore((s) => s.setLastDraft);
  const openConfirm = useLoanStore((s) => s.openConfirm);
  const [result, setResult] = useState<CheckResult | null>(null);
  const maxAffordable = Math.max(0, 3 * annualizedProfit);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<LoanFormInput, unknown, LoanFormValues>({
    resolver: zodResolver(loanSchema),
    defaultValues: { amount: 10_000, purpose: LOAN_PURPOSES[0], months: '12', partnerId: '' },
  });

  const [amountRaw, monthsRaw, partnerId, purpose] = useWatch({
    control,
    name: ['amount', 'months', 'partnerId', 'purpose'],
  });
  const amount = Number(amountRaw) || 0;
  const period = Number(monthsRaw);
  const lenders = lendersForPeriod(period);
  const selected = lenders.find((p) => p.id === partnerId);
  const cheapest = lenders.reduce<LoanPartner | undefined>(
    (low, p) => (!low || p.rate < low.rate ? p : low),
    undefined,
  );

  // If the chosen lender doesn't offer the new period, clear the choice.
  useEffect(() => {
    if (partnerId && !lendersForPeriod(period).some((p) => p.id === partnerId)) {
      setValue('partnerId', '');
    }
  }, [period, partnerId, setValue]);

  // Share the builder's live values so lender cards price the same loan.
  useEffect(() => {
    setLastDraft(
      amount >= MIN_LOAN
        ? { amount, months: period, purpose: String(purpose), partnerId: String(partnerId ?? '') }
        : null,
    );
  }, [amount, period, purpose, partnerId, setLastDraft]);

  function onSubmit(values: LoanFormValues) {
    const partner = findPartner(values.partnerId);
    if (!partner) return;
    setResult({
      values,
      partner,
      eligibility: checkEligibility({
        amount: values.amount,
        records,
        score: credit.score,
        partner,
      }),
      repayment: monthlyRepayment(values.amount, partner.rate, values.months),
    });
  }

  const stale =
    result !== null &&
    (amount !== result.values.amount ||
      period !== result.values.months ||
      partnerId !== result.values.partnerId ||
      purpose !== result.values.purpose);

  // Slider track: green up to the borrowing limit, neutral beyond it.
  const limitPct = Math.min(100, (maxAffordable / SLIDER_MAX) * 100);
  const withinLimit = amount <= maxAffordable;
  const trackStyle: CSSProperties = {
    background: `linear-gradient(to right, color-mix(in oklab, var(--accent) 55%, transparent) ${limitPct}%, var(--glass-strong) ${limitPct}%)`,
  };

  return (
    <Card id="apply" className={cn('@container scroll-mt-28', className)}>
      <CardHeader>
        <div>
          <CardTitle>Loan Builder</CardTitle>
          <CardSub>Adjust the amount and term. Your payment updates instantly.</CardSub>
        </div>
      </CardHeader>

      {/*
        Wide card: fields | live estimate side by side, button underneath both.
        Narrow card: fields, then the estimate, then the button (the payment is seen before checking).
      */}
      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 @xl:grid-cols-[minmax(0,1fr)_240px]"
      >
        <div className="@container min-w-0 space-y-6">
          {/* Amount: number input + slider */}
          <FormField
            label="How much do you need?"
            htmlFor="loan-amount"
            error={errors.amount?.message}
          >
            <div className="relative">
              <span className="text-text-mute pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base font-semibold">
                GHS
              </span>
              <input
                id="loan-amount"
                type="number"
                inputMode="numeric"
                min={MIN_LOAN}
                step={100}
                aria-invalid={Boolean(errors.amount) || undefined}
                aria-describedby={errors.amount ? fieldErrorId('loan-amount') : 'loan-limit-note'}
                {...register('amount')}
                className={cn(
                  'bg-bg-2 text-text focus:border-accent min-h-14 w-full rounded-2xl border pr-4 pl-16 text-2xl font-extrabold tracking-tight focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:outline-none',
                  errors.amount ? 'border-danger' : 'border-border',
                )}
              />
            </div>
            <input
              type="range"
              min={MIN_LOAN}
              max={SLIDER_MAX}
              step={SLIDER_STEP}
              value={Math.min(SLIDER_MAX, Math.max(MIN_LOAN, amount))}
              onChange={(event) =>
                setValue('amount', Number(event.target.value), { shouldValidate: true })
              }
              aria-label="Loan amount slider"
              style={trackStyle}
              className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full [&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_var(--accent-glow)]"
            />
            <div className="text-text-mute flex justify-between text-[11px]">
              <span>{formatGHS(MIN_LOAN)}</span>
              <span>{formatGHS(SLIDER_MAX)}</span>
            </div>
            <p
              id="loan-limit-note"
              className={cn(
                'text-xs font-semibold',
                maxAffordable < MIN_LOAN
                  ? 'text-text-mute'
                  : withinLimit
                    ? 'text-ink-green'
                    : 'text-ink-gold',
              )}
            >
              {maxAffordable < MIN_LOAN
                ? 'Record profitable sales to unlock a borrowing limit.'
                : withinLimit
                  ? `Within your limit. You may be able to borrow up to ${formatGHS(maxAffordable)}`
                  : `Above your limit of ${formatGHS(maxAffordable)}`}
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setValue('amount', value, { shouldValidate: true })}
                  className={cn(
                    'min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors',
                    amount === value
                      ? 'border-accent/50 bg-accent/15 text-ink-green'
                      : 'border-border bg-glass text-text-dim hover:text-text',
                  )}
                >
                  {formatGHS(value)}
                </button>
              ))}
              {maxAffordable >= MIN_LOAN && (
                <button
                  type="button"
                  onClick={() =>
                    setValue('amount', Math.floor(maxAffordable / 100) * 100, {
                      shouldValidate: true,
                    })
                  }
                  className="border-accent/40 bg-accent/10 text-ink-green min-h-9 rounded-full border px-3 text-xs font-semibold"
                >
                  Max {formatGHS(maxAffordable)}
                </button>
              )}
            </div>
          </FormField>

          {/* Purpose as icon chips */}
          <fieldset>
            <legend className="text-text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
              What is it for?
            </legend>
            <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-5">
              {LOAN_PURPOSES.map((p) => {
                const Icon = PURPOSE_ICONS[p] ?? Sprout;
                return (
                  <label key={p} className="relative">
                    <input
                      type="radio"
                      value={p}
                      {...register('purpose')}
                      className="peer sr-only"
                    />
                    <span className="border-border bg-glass text-text-dim peer-checked:border-accent/60 peer-checked:bg-accent/15 peer-checked:text-ink-green peer-focus-visible:outline-accent hover:text-text flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-center text-xs font-semibold transition-colors peer-focus-visible:outline-2">
                      <Icon size={20} aria-hidden="true" />
                      {p}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Term */}
          <fieldset>
            <legend className="text-text-dim mb-2 text-xs font-semibold tracking-wide uppercase">
              Repayment period
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {LOAN_PERIODS.map((m) => (
                <label key={m} className="relative">
                  <input
                    type="radio"
                    value={String(m)}
                    {...register('months')}
                    className="peer sr-only"
                  />
                  <span className="border-border bg-glass text-text-dim peer-checked:border-accent/60 peer-checked:bg-accent/15 peer-checked:text-ink-green peer-focus-visible:outline-accent hover:text-text flex min-h-12 cursor-pointer flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors peer-focus-visible:outline-2">
                    {m}
                    <span className="text-[10px] font-medium">months</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <FormField
            label="Lender"
            htmlFor="loan-partner"
            error={errors.partnerId?.message}
            hint={`${lenders.length} of 4 lenders offer ${period}-month loans`}
          >
            <Select id="loan-partner" error={Boolean(errors.partnerId)} {...register('partnerId')}>
              <option value="">Choose a lender</option>
              {lenders.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.rate}% p.a.
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className="@xl:sticky @xl:top-28 @xl:self-start">
          <LivePreview
            amount={amount}
            months={period}
            partner={selected ?? cheapest}
            isCheapest={!selected}
          />
        </div>

        <Button type="submit" icon={ShieldCheck} className="w-full @xl:col-span-2">
          Check Eligibility
        </Button>
      </form>

      {result && (
        <div className={cn('mt-6 transition-opacity', stale && 'opacity-50')}>
          {stale && (
            <p className="text-ink-gold mb-2 text-xs font-semibold">
              Your inputs changed. Check eligibility again to update.
            </p>
          )}
          <EligibilityResult
            eligibility={result.eligibility}
            repayment={result.repayment}
            amount={result.values.amount}
            months={result.values.months}
            partner={result.partner}
            onApply={() => openConfirm(result.values)}
            onUseAmount={(value) => {
              setValue('amount', value, { shouldValidate: true });
              onSubmit({ ...result.values, amount: value });
            }}
          />
        </div>
      )}
    </Card>
  );
}
