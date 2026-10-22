'use client';

import { useState } from 'react';
import { Hourglass, Lock, ShieldCheck } from 'lucide-react';
import { GhanaCardModal } from '@/components/profile/ghana-card-modal';
import { Button } from '@/components/ui/button';
import { useGhanaCardStatus } from '@/hooks/use-ghana-card';
import { useProfileStore } from '@/store/profile-store';

/**
 * Top of /loans while the Ghana Card isn't verified: loans are locked (the score and offers
 * stay visible). "Verify now" opens the same Ghana Card dialog as the Profile page.
 */
export function GhanaCardLock() {
  const status = useGhanaCardStatus();
  const reason = useProfileStore((s) => s.profile?.ghanaCard.rejectedReason);
  const [open, setOpen] = useState(false);
  if (status === 'verified') return null;
  const pending = status === 'pending';

  return (
    <section
      aria-labelledby="loans-locked-title"
      className="border-gold/40 bg-gold/10 flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center"
    >
      <span className="bg-gold/20 text-ink-gold inline-flex size-12 shrink-0 items-center justify-center rounded-2xl">
        {pending ? (
          <Hourglass size={22} aria-hidden="true" />
        ) : (
          <Lock size={22} aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="loans-locked-title" className="text-text text-base font-bold">
          {pending
            ? 'Your Ghana Card is being reviewed'
            : 'Loans are locked until your Ghana Card is verified'}
        </h2>
        <p className="text-text-dim mt-1 text-sm">
          {pending
            ? 'You can apply once it is verified, usually within one working day. Your score and offers are below.'
            : status === 'rejected'
              ? (reason ?? 'Your last card was rejected. Please resubmit it.')
              : 'You can still see your credit score and lender offers. Verify your card to apply.'}
        </p>
      </div>
      {!pending && (
        <Button icon={ShieldCheck} onClick={() => setOpen(true)} mutates className="shrink-0">
          Verify now
        </Button>
      )}
      <GhanaCardModal open={open} onClose={() => setOpen(false)} />
    </section>
  );
}
