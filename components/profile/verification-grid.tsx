'use client';

import { useState } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  Hourglass,
  MapPin,
  Smartphone,
  UserRoundCheck,
} from 'lucide-react';
import { GhanaCardModal } from '@/components/profile/ghana-card-modal';
import { GpsField } from '@/components/profile/gps-field';
import { PhoneVerifyModal } from '@/components/profile/phone-verify-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { maskGhanaCard } from '@/lib/profile';
import { cn } from '@/lib/utils';
import { useProfileStore } from '@/store/profile-store';

export function VerificationGrid() {
  const profile = useProfileStore((state) => state.profile);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const items = [
    {
      title: 'Account Created',
      icon: UserRoundCheck,
      verified: true,
      detail: 'Your AgriCtec account is active.',
    },
    {
      title: 'Phone',
      icon: Smartphone,
      verified: profile?.verification.phone,
      detail: profile?.phone || 'Add your phone number.',
      action: () => setPhoneOpen(true),
    },
    {
      title: 'Farm Location',
      icon: MapPin,
      verified: profile?.verification.location,
      detail: 'Locate your farm on the map.',
      action: () => {
        document
          .getElementById('farm-location')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        document
          .getElementById('farm-location')
          ?.querySelector('button')
          ?.focus({ preventScroll: true });
      },
    },
    {
      title: 'Ghana Card',
      icon: BadgeCheck,
      verified: profile?.verification.ghanaCard,
      detail: profile?.verification.ghanaCard
        ? maskGhanaCard(profile.ghanaCardLast4)
        : 'Verify your identity in demo mode.',
      action: () => setCardOpen(true),
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
        {items.map(({ title, icon: Icon, verified, detail, action }) => (
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
              <Badge color={verified ? 'green' : 'gold'}>
                {verified ? (
                  <Check size={11} aria-hidden="true" />
                ) : (
                  <Hourglass size={11} aria-hidden="true" />
                )}
                {verified ? 'Verified' : 'Pending'}
              </Badge>
            </div>
            <p className="text-text mt-3 text-sm font-semibold">{title}</p>
            <p className="text-text-mute mt-1 text-xs leading-relaxed break-words">{detail}</p>
            {!verified && action && (
              <Button
                size="sm"
                variant="ghost"
                onClick={action}
                icon={ArrowUpRight}
                className="mt-3"
              >
                {title === 'Farm Location' ? 'Set location' : 'Verify'}
              </Button>
            )}
          </div>
        ))}
      </div>
      <GpsField />
      <PhoneVerifyModal open={phoneOpen} onClose={() => setPhoneOpen(false)} />
      <GhanaCardModal open={cardOpen} onClose={() => setCardOpen(false)} />
    </Card>
  );
}
