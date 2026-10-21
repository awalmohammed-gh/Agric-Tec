'use client';

import { Check, Minus, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { formatGHS } from '@/lib/format';
import { usePlatformStore } from '@/store/platform-store';

/** The Premium preview. Its price and features come from the admin's plans. */
export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const plans = usePlatformStore((s) => s.plans);
  const free = plans.find((plan) => plan.id === 'free');
  const premium = plans.find((plan) => plan.id === 'premium');
  if (!premium) return null;

  return (
    <Modal open={open} title="More possibilities for your farm" onClose={onClose} size="lg">
      <div className="text-center">
        <Badge color="purple">
          <Sparkles size={12} aria-hidden="true" />
          {premium.name} preview
        </Badge>
        <p className="font-display text-text mt-4 text-3xl font-bold">
          {formatGHS(premium.priceGHS)}
          <span className="text-text-mute text-base font-normal"> / month</span>
        </p>
        <p className="text-text-mute mt-2 text-sm">A planned upgrade. No payment is collected.</p>
      </div>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-80 text-left text-sm">
          <caption className="sr-only">
            {free?.name ?? 'Free Plan'} and {premium.name} feature comparison
          </caption>
          <thead>
            <tr className="border-border border-b">
              <th scope="col" className="py-3 pr-3">
                Feature
              </th>
              <th scope="col" className="px-3 py-3">
                {free?.name ?? 'Free Plan'}
              </th>
              <th scope="col" className="text-ink-green px-3 py-3">
                {premium.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {premium.features.map((feature) => (
              <tr key={feature} className="border-border border-b">
                <th scope="row" className="text-text-dim py-3 pr-3 font-normal">
                  {feature}
                </th>
                <td className="text-text-mute px-3">
                  {free?.features.includes(feature) ? (
                    <Check size={17} aria-label="Included" className="text-ink-green" />
                  ) : (
                    <Minus size={16} aria-label="Not included" />
                  )}
                </td>
                <td className="text-ink-green px-3">
                  <Check size={17} aria-label="Included" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button disabled icon={Sparkles} className="mt-6 w-full">
        Coming soon
      </Button>
    </Modal>
  );
}
