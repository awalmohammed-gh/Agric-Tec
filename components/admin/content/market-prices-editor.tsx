'use client';

import { useEffect, useState } from 'react';
import { Plus, RotateCcw, Save, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { LastUpdated } from '@/components/admin/content/content-kit';
import { PRIMARY_CLASS } from '@/components/admin/shared/action-styles';
import { Button } from '@/components/ui/button';
import { CROP_TONES, CropIcon, cropFromName } from '@/components/ui/crop-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { PLATFORM_KEYS } from '@/lib/admin/keys';
import { cn } from '@/lib/utils';
import { contentService } from '@/services/admin/content.service';
import type { MarketPrice } from '@/types';
import type { ContentMeta } from '@/types/admin';

interface Row extends MarketPrice {
  /** A stable key while editing (rows can be added and removed). */
  key: string;
}

let nextKey = 0;
const toRows = (prices: MarketPrice[]): Row[] =>
  prices.map((p) => ({ ...p, key: `row-${nextKey++}` }));
const toPrices = (rows: Row[]): MarketPrice[] =>
  rows.map(({ crop, unit, price, change }) => ({
    crop: crop.trim(),
    unit: unit.trim(),
    price,
    change,
  }));

/** What's wrong with a row (null = fine). */
function rowError(row: Row, rows: Row[]): string | null {
  if (!row.crop.trim()) return 'Name the crop.';
  if (rows.filter((r) => r.crop.trim().toLowerCase() === row.crop.trim().toLowerCase()).length > 1)
    return 'Each crop once.';
  if (!row.unit.trim()) return 'Add a unit.';
  if (!Number.isFinite(row.price) || row.price < 0 || row.price > 1_000_000)
    return 'Price 0–1,000,000.';
  if (!Number.isFinite(row.change) || row.change < -100 || row.change > 1000)
    return 'Change −100–1000%.';
  return null;
}

const cell =
  'border-border bg-bg-2 text-text focus:border-purple/70 min-h-10 w-full min-w-0 rounded-lg border px-2.5 text-sm outline-none';

/**
 * The prices farmers see on the market page. Edit inline, add or remove crops, then save them
 * all at once (audited). Crops & yields compares each crop's price per tonne with these.
 */
export function MarketPricesEditor() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [saved, setSaved] = useState<MarketPrice[]>([]);
  const [meta, setMeta] = useState<ContentMeta | undefined>();
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([contentService.getMarketPrices(), contentService.getContentMeta()]).then(
      ([prices, metas]) => {
        if (!active) return;
        setSaved(prices);
        setRows(toRows(prices));
        setMeta(metas[PLATFORM_KEYS.market]);
      },
    );
    return () => {
      active = false;
    };
  }, [version]);

  if (!rows) return <Skeleton className="h-80 w-full rounded-2xl" />;

  const errors = rows.map((row) => rowError(row, rows));
  const valid = rows.length > 0 && errors.every((e) => e === null);
  const dirty = JSON.stringify(toPrices(rows)) !== JSON.stringify(saved);
  const update = (key: string, patch: Partial<MarketPrice>) =>
    setRows(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  async function save() {
    if (!rows) return;
    setSaving(true);
    try {
      await contentService.saveMarketPrices(toPrices(rows));
      toast.success('Market prices saved', { description: 'Farmers see them straight away.' });
      setVersion((v) => v + 1);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not save the prices');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby="market-title" className="border-border bg-glass rounded-2xl border">
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 id="market-title" className="text-text text-sm font-semibold">
            Market prices
          </h2>
          <LastUpdated meta={meta} className="mt-1" />
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            icon={RotateCcw}
            disabled={!dirty || saving}
            onClick={() => setRows(toRows(saved))}
          >
            Reset
          </Button>
          <Button
            size="sm"
            icon={Save}
            loading={saving}
            disabled={!dirty || !valid}
            onClick={() => void save()}
            className={PRIMARY_CLASS}
          >
            Save all
          </Button>
        </div>
      </header>

      {/* Column labels (rows stack into cards on phones). */}
      <div
        aria-hidden="true"
        className="text-text-mute border-border hidden grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem] gap-3 border-y px-5 py-2 text-[11px] font-semibold tracking-wider uppercase md:grid"
      >
        <span />
        <span>Crop</span>
        <span>Unit</span>
        <span>Price (GHS)</span>
        <span>Change %</span>
        <span />
      </div>

      <ul aria-label="Market prices" className="divide-border divide-y">
        {rows.map((row, index) => {
          const crop = cropFromName(row.crop);
          const error = errors[index];
          return (
            <li key={row.key} className="px-5 py-3">
              <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_2.25rem] items-center gap-3 md:grid-cols-[2.25rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_2.25rem]">
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-flex size-9 items-center justify-center rounded-lg',
                    CROP_TONES[crop],
                  )}
                >
                  <CropIcon crop={crop} size={16} />
                </span>
                <input
                  aria-label={`Crop ${index + 1}`}
                  value={row.crop}
                  maxLength={40}
                  onChange={(e) => update(row.key, { crop: e.target.value })}
                  className={cn(cell, 'font-semibold')}
                />
                <button
                  type="button"
                  onClick={() => setRows(rows.filter((r) => r.key !== row.key))}
                  aria-label={`Remove ${row.crop || 'this crop'}`}
                  className="text-text-mute hover:text-ink-red hover:bg-glass-strong inline-flex size-9 items-center justify-center rounded-lg transition-colors md:order-last"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
                <div className="col-span-3 grid grid-cols-3 gap-2 md:contents">
                  <label className="min-w-0">
                    <span className="text-text-mute mb-1 block text-[11px] md:sr-only">Unit</span>
                    <input
                      aria-label={`Unit for ${row.crop}`}
                      value={row.unit}
                      maxLength={30}
                      onChange={(e) => update(row.key, { unit: e.target.value })}
                      className={cell}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-text-mute mb-1 block text-[11px] md:sr-only">
                      Price (GHS)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      aria-label={`Price of ${row.crop} in GHS`}
                      value={Number.isFinite(row.price) ? row.price : ''}
                      onChange={(e) => update(row.key, { price: Number(e.target.value || NaN) })}
                      className={cn(cell, 'tabular-nums')}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="text-text-mute mb-1 block text-[11px] md:sr-only">
                      Change %
                    </span>
                    <span className="relative block">
                      <input
                        type="number"
                        step="0.1"
                        inputMode="decimal"
                        aria-label={`Price change of ${row.crop} in percent`}
                        value={Number.isFinite(row.change) ? row.change : ''}
                        onChange={(e) => update(row.key, { change: Number(e.target.value || NaN) })}
                        className={cn(
                          cell,
                          'pr-7 tabular-nums',
                          row.change > 0 ? 'text-ink-green' : row.change < 0 ? 'text-ink-red' : '',
                        )}
                      />
                      {row.change !== 0 && Number.isFinite(row.change) && (
                        <span
                          aria-hidden="true"
                          className="absolute top-1/2 right-2 -translate-y-1/2"
                        >
                          {row.change > 0 ? (
                            <TrendingUp size={13} className="text-ink-green" />
                          ) : (
                            <TrendingDown size={13} className="text-ink-red" />
                          )}
                        </span>
                      )}
                    </span>
                  </label>
                </div>
              </div>
              {error && (
                <p role="alert" className="text-ink-red mt-1.5 text-xs md:pl-12">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="border-border border-t px-5 py-3">
        <button
          type="button"
          disabled={rows.length >= 30}
          onClick={() =>
            setRows([
              ...rows,
              { key: `row-${nextKey++}`, crop: '', unit: '100kg bag', price: 0, change: 0 },
            ])
          }
          className="text-ink-purple inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold disabled:opacity-40"
        >
          <Plus size={15} aria-hidden="true" />
          Add crop
        </button>
      </div>
    </section>
  );
}
