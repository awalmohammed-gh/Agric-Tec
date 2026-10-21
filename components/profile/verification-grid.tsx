'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  Check,
  Circle,
  Hourglass,
  MapPin,
  Smartphone,
  UserRoundCheck,
  type LucideIcon,
} from 'lucide-react';
import { GhanaCardModal } from '@/components/profile/ghana-card-modal';
import { GpsField } from '@/components/profile/gps-field';
import { PhoneVerifyModal } from '@/components/profile/phone-verify-modal';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { maskGhanaCard } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { usePlatformStore } from '@/store/platform-store';
import { useProfileStore } from '@/store/profile-store';

type CheckState = 'verified' | 'review' | 'rejected' | 'todo';

const STATE_BADGE: Record<CheckState, { label: string; color: BadgeColor; icon: LucideIcon }> = {
  verified: { label: 'Verified', color: 'green', icon: Check },
  review: { label: 'Under review', color: 'gold', icon: Hourglass },
  rejected: { label: 'Rejected', color: 'red', icon: Ban },
  todo: { label: 'Not verified', color: 'blue', icon: Circle },
};

interface CheckItem {
  title: string;
  icon: LucideIcon;
  state: CheckState;
  detail: string;
  action?: { label: string; run: () => void };
}

export function VerificationGrid() {
  const profile = useProfileStore((state) => state.profile);
  // The latest Ghana Card request: pending until an admin approves or rejects it.
  const cardRequest = usePlatformStore((state) =>
    state.verifications.find((v) => v.kind === 'ghanaCard'),
  );
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  const cardState: CheckState = profile?.verification.ghanaCard
    ? 'verified'
    : cardRequest?.status === 'pending'
      ? 'review'
      : cardRequest?.status === 'rejected'
        ? 'rejected'
        : 'todo';
  const cardDetail: Record<CheckState, string> = {
    verified: maskGhanaCard(profile?.ghanaCardLast4),
    review: `${cardRequest?.submittedValue ?? 'Your card'} is waiting for review. This usually takes one working day.`,
    rejected: `Not approved: ${cardRequest?.reason ?? 'please submit your card again'}.`,
    todo: 'Verify your identity in demo mode.',
  };

  const items: CheckItem[] = [
    {
      title: 'Account Created',
      icon: UserRoundCheck,
      state: 'verified',
      detail: 'Your AgriCtec account is active.',
    },
    {
      title: 'Phone',
      icon: Smartphone,
      state: profile?.verification.phone ? 'verified' : 'todo',
      detail: profile?.phone || 'Add your phone number.',
      action: { label: 'Verify', run: () => setPhoneOpen(true) },
    },
    {
      title: 'Farm Location',
      icon: MapPin,
      state: profile?.verification.location ? 'verified' : 'todo',
      detail: 'Locate your farm on the map.',
      action: {
        label: 'Set location',
        run: () => {
          document
            .getElementById('farm-location')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          document
            .getElementById('farm-location')
            ?.querySelector('button')
            ?.focus({ preventScroll: true });
        },
      },
    },
    {
      title: 'Ghana Card',
      icon: BadgeCheck,
      state: cardState,
      detail: cardDetail[cardState],
      action: {
        label: cardState === 'rejected' ? 'Try again' : 'Verify',
        run: () => setCardOpen(true),
      },
    },
  ];

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <div>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck size={18} aria-hidden="true" className="text-ink-green" />
            Identity & verification
          </CardTitle>
          <CardSub>Build a more complete farmer profile. Identity checks are demo only.</CardSub>
        </div>
      </CardHeader>
      <div className="mb-5 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-4">
        {items.map(({ title, icon: Icon, state, detail, action }) => {
          const badge = STATE_BADGE[state];
          const BadgeIcon = badge.icon;
          const verified = state === 'verified';
          return (
            <div
              key={title}
              className={cn(
                'rounded-2xl border p-4',
                verified ? 'border-accent/30 bg-accent/5' : 'border-border bg-bg-2/40',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Icon
                  size={20}
                  aria-hidden="true"
                  className={verified ? 'text-ink-green' : 'text-text-mute'}
                />
                <Badge color={badge.color}>
                  <BadgeIcon size={11} aria-hidden="true" />
                  {badge.label}
                </Badge>
              </div>
              <p className="text-text mt-3 text-sm font-semibold">{title}</p>
              <p className="text-text-mute mt-1 text-xs leading-relaxed break-words">{detail}</p>
              {(state === 'todo' || state === 'rejected') && action && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={action.run}
                  icon={ArrowUpRight}
                  className="mt-3"
                >
                  {action.label}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <GpsField />
      <PhoneVerifyModal open={phoneOpen} onClose={() => setPhoneOpen(false)} />
      <GhanaCardModal open={cardOpen} onClose={() => setCardOpen(false)} />
    </Card>
  );
}
