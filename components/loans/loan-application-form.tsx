'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, Sparkles } from 'lucide-react';
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

const QUICK_AMOUNTS = [5_000, 10_000, 25_000];

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
    defaultValues: { amount: '', purpose: LOAN_PURPOSES[0], months: '12', partnerId: '' },
  });

  const [amount, months, partnerId, purpose] = useWatch({
    control,
    name: ['amount', 'months', 'partnerId', 'purpose'],
  });
  const period = Number(months);
  const lenders = lendersForPeriod(period);

  // If the chosen lender doesn't offer the new period, clear the choice.
  useEffect(() => {
    if (partnerId && !lendersForPeriod(period).some((p) => p.id === partnerId)) {
      setValue('partnerId', '');
    }
  }, [period, partnerId, setValue]);

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
    setLastDraft(values);
  }

  // A result is stale once the farmer changes any input after checking.
  const stale =
    result !== null &&
    (Number(amount) !== result.values.amount ||
      period !== result.values.months ||
      partnerId !== result.values.partnerId ||
      purpose !== result.values.purpose);

  return (
    <Card id="apply" className={cn('scroll-mt-28', className)}>
      <CardHeader>
        <div>
          <CardTitle>Apply for a Loan</CardTitle>
          <CardSub>Check your eligibility instantly. Nothing is sent until you apply.</CardSub>
        </div>
      </CardHeader>

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <FormField label="Loan amount (GHS)" htmlFor="loan-amount" error={errors.amount?.message}>
          <div className="relative">
            <span className="text-text-mute pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-semibold">
              GHS
            </span>
            <input
              id="loan-amount"
              type="number"
              inputMode="numeric"
              min={MIN_LOAN}
              step={100}
              placeholder="10,000"
              aria-invalid={Boolean(errors.amount) || undefined}
              aria-describedby={errors.amount ? fieldErrorId('loan-amount') : undefined}
              {...register('amount')}
              className={cn(
                'bg-bg-2 text-text focus:border-accent min-h-12 w-full rounded-xl border pr-3.5 pl-14 text-lg font-bold focus:shadow-[0_0_0_3px_var(--accent-glow)] focus:outline-none',
                errors.amount ? 'border-danger' : 'border-border',
              )}
            />
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('amount', value, { shouldValidate: true })}
                className="border-border bg-glass text-text-dim hover:border-accent/50 hover:text-text min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors"
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

        <FormField label="Purpose" htmlFor="loan-purpose" error={errors.purpose?.message}>
          <Select id="loan-purpose" error={Boolean(errors.purpose)} {...register('purpose')}>
            {LOAN_PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </FormField>

        <fieldset>
          <legend className="text-text-dim mb-1.5 text-xs font-semibold tracking-wide uppercase">
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
                <span className="border-border bg-glass text-text-dim peer-checked:border-accent/60 peer-checked:bg-accent/15 peer-checked:text-ink-green peer-focus-visible:outline-accent hover:text-text flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl border text-sm font-bold transition-colors peer-focus-visible:outline-2">
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

        {maxAffordable >= MIN_LOAN ? (
          <p className="border-purple/30 bg-purple/10 text-text flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm">
            <Sparkles size={16} aria-hidden="true" className="text-ink-purple shrink-0" />
            <span>
              You may be able to borrow up to <strong>{formatGHS(maxAffordable)}</strong>
            </span>
          </p>
        ) : (
          <p className="border-border bg-glass text-text-dim flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm">
            <Sparkles size={16} aria-hidden="true" className="text-ink-purple shrink-0" />
            Record profitable sales to unlock a borrowing limit.
          </p>
        )}

        <Button type="submit" icon={ShieldCheck} className="w-full">
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
