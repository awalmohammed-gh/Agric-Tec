'use client';

import { useState } from 'react';
import { BadgeDollarSign, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { ListEditor } from '@/components/admin/content/content-kit';
import { SettingsCard } from '@/components/admin/settings/settings-card';
import { PRIMARY_CLASS } from '@/components/admin/shared/action-styles';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { configService } from '@/services/admin/config.service';
import type { Plan } from '@/types/admin';

const clean = (plans: Plan[]): Plan[] =>
  plans.map((p) => ({
    ...p,
    name: p.name.trim(),
    features: p.features.map((f) => f.trim()).filter(Boolean),
  }));

/**
 * The plans in the farmer app's upgrade dialog: the Premium price (GHS), each plan's features and
 * whether it is offered. Saved together (audited); farmers see it the next time they open it.
 */
export function PlansEditor({
  plans,
  onSaved,
}: {
  plans: Plan[];
  onSaved: (plans: Plan[]) => void;
}) {
  const [draft, setDraft] = useState<Plan[]>(plans);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(clean(draft)) !== JSON.stringify(plans);
  const premium = draft.find((p) => p.id === 'premium');
  const priceError =
    premium &&
    (!Number.isFinite(premium.priceGHS) || premium.priceGHS <= 0 || premium.priceGHS > 10_000)
      ? 'Enter a price between GHS 1 and GHS 10,000.'
      : null;
  const featureError = draft.some((p) => clean([p])[0].features.length === 0)
    ? 'Each plan needs at least one feature.'
    : null;

  const update = (id: Plan['id'], patch: Partial<Plan>) =>
    setDraft(draft.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  async function save() {
    setSaving(true);
    try {
      const saved = await configService.savePlans(clean(draft));
      setDraft(saved);
      onSaved(saved);
      toast.success('Plans saved', {
        description: 'The farmer upgrade dialog shows the new details.',
      });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the plans');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsCard
      id="plans"
      icon={BadgeDollarSign}
      title="Plans"
      description="What farmers see in the upgrade dialog. No payment is collected yet."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {draft.map((plan) => {
          const isPremium = plan.id === 'premium';
          return (
            <article
              key={plan.id}
              className={cn(
                'rounded-2xl border p-4',
                isPremium ? 'border-purple/40 bg-purple/6' : 'border-border',
                !plan.active && 'opacity-70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-text-mute text-[11px] font-semibold tracking-wider uppercase">
                    {isPremium ? 'Paid plan' : 'Default plan'}
                  </p>
                  <p className="text-text font-display text-lg font-bold">{plan.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-text-mute text-xs">
                    {plan.active ? 'Offered' : 'Hidden'}
                  </span>
                  <Switch
                    checked={plan.active}
                    disabled={!isPremium}
                    onChange={(active) => update(plan.id, { active })}
                    label={`${plan.name} offered`}
                  />
                </div>
              </div>

              <label className="mt-4 block">
                <span className="text-text-dim mb-1.5 block text-xs font-semibold">
                  Price per month
                </span>
                <span
                  className={cn(
                    'bg-bg-2 flex min-h-11 items-center gap-2 rounded-xl border px-3.5',
                    priceError && isPremium
                      ? 'border-danger'
                      : 'border-border focus-within:border-purple/70',
                  )}
                >
                  <span className="text-text-mute text-sm font-semibold">GHS</span>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    inputMode="decimal"
                    disabled={!isPremium}
                    value={Number.isFinite(plan.priceGHS) ? plan.priceGHS : ''}
                    onChange={(e) => update(plan.id, { priceGHS: Number(e.target.value || NaN) })}
                    className="text-text font-display min-w-0 flex-1 bg-transparent text-lg font-bold tabular-nums outline-none disabled:opacity-60"
                  />
                </span>
                {isPremium && priceError && (
                  <span role="alert" className="text-ink-red mt-1.5 block text-xs font-semibold">
                    {priceError}
                  </span>
                )}
                {!isPremium && (
                  <span className="text-text-mute mt-1.5 block text-xs">
                    The free plan is always free and always offered.
                  </span>
                )}
              </label>

              <div className="mt-4">
                <ListEditor
                  label="Features"
                  items={plan.features}
                  onChange={(features) => update(plan.id, { features })}
                  min={1}
                  max={8}
                  addLabel="Add feature"
                  placeholder="e.g. Unlimited reports"
                />
              </div>
            </article>
          );
        })}
      </div>

      {featureError && (
        <p role="alert" className="text-ink-red mt-3 text-xs font-semibold">
          {featureError}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="ghost"
          icon={RotateCcw}
          disabled={!dirty || saving}
          onClick={() => setDraft(plans)}
        >
          Undo
        </Button>
        <Button
          icon={Save}
          loading={saving}
          disabled={!dirty || Boolean(priceError) || Boolean(featureError)}
          onClick={() => void save()}
          className={PRIMARY_CLASS}
        >
          Save plans
        </Button>
      </div>
    </SettingsCard>
  );
}
