'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Calculator,
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
import { defaultOfferId, rankOffers } from '@/components/loans/loan-offers';
import {
  findPartner,
  loanSchema,
  MIN_LOAN,
  type LoanFormInput,
  type LoanFormValues,
} from '@/components/loans/loan-schema';
import { OfferPicker } from '@/components/loans/offer-picker';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { FormField, fieldErrorId } from '@/components/ui/form-field';
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

const stepLabel = 'text-text-dim mb-2 text-xs font-semibold tracking-wide uppercase';

/**
 * Loan builder: amount, purpose and term on one side; every lender priced for that loan on
 * the other, so choosing a lender is comparing them. Then an eligibility check and apply.
 */
export function LoanApplicationForm({ className }: { className?: string }) {
  const records = useFarmStore((s) => s.records);
  const { credit, annualizedProfit } = useFarmStats();
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
  const offers = rankOffers(amount, period, credit.score);
  const selected = offers.find((o) => o.partner.id === partnerId && o.offersTerm);

  // Keep a lender picked: the best offer by default, and again when the term rules one out.
  const fallbackId = defaultOfferId(offers);
  useEffect(() => {
    if (!selected && fallbackId) setValue('partnerId', fallbackId);
  }, [selected, fallbackId, setValue]);

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
  const valid = amount >= MIN_LOAN && selected !== undefined;

  return (
    <Card id="apply" className={cn('@container scroll-mt-28 rounded-3xl', className)}>
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <Calculator size={17} aria-hidden="true" className="text-ink-green" />
            Build your loan
          </CardTitle>
          <CardSub>Set the amount and term, then pick the offer that suits you.</CardSub>
        </div>
      </CardHeader>

      <form
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className="grid grid-cols-1 gap-6 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]"
      >
        <div className="@container min-w-0 space-y-6">
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

          <fieldset>
            <legend className={stepLabel}>What is it for?</legend>
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

          <fieldset>
            <legend className={stepLabel}>Repayment period</legend>
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
        </div>

        {/* Offers + summary: beside the fields when wide, under them on phones */}
        <div id="offers" className="scroll-mt-28 space-y-4 @3xl:sticky @3xl:top-28 @3xl:self-start">
          <OfferPicker
            offers={offers}
            months={period}
            selectedId={String(partnerId ?? '')}
            registration={register('partnerId')}
            error={errors.partnerId?.message}
          />

          <div
            aria-live="polite"
            className="border-accent/30 from-accent/15 via-accent/5 rounded-2xl border bg-linear-to-br to-transparent p-4"
          >
            <p className="text-text-mute text-[11px] font-semibold tracking-wider uppercase">
              Your loan
            </p>
            {valid ? (
              <>
                <p className="text-ink-green mt-1 text-3xl font-extrabold tracking-tight tabular-nums">
                  {formatGHS(selected.repayment.monthly)}
                  <span className="text-text-mute text-sm font-semibold"> /month</span>
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-text-mute">Borrow</dt>
                    <dd className="text-text font-semibold tabular-nums">{formatGHS(amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-mute">Interest</dt>
                    <dd className="text-text font-semibold tabular-nums">
                      {formatGHS(selected.repayment.interest)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-mute">Total</dt>
                    <dd className="text-text font-bold tabular-nums">
                      {formatGHS(selected.repayment.total)}
                    </dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="text-text-mute mt-1 text-sm">
                {amount < MIN_LOAN
                  ? `Enter at least ${formatGHS(MIN_LOAN)} to see your payment.`
                  : `No lender offers ${period}-month loans. Try another period.`}
              </p>
            )}
            <Button type="submit" icon={ShieldCheck} className="mt-4 w-full">
              Check eligibility
            </Button>
            <p className="text-text-mute mt-2 text-center text-[11px]">
              Estimates only. The lender sets final terms.
            </p>
          </div>
        </div>
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
