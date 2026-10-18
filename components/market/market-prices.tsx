'use client';

import { useId, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles, Store } from 'lucide-react';
import { AiChip } from '@/components/ui/ai-chip';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { CropTile, cropFromName } from '@/components/ui/crop-icon';
import { Select } from '@/components/ui/select';
import { formatGHS } from '@/lib/format';
import {
  formatPriceChange,
  isPrimaryCrop,
  sortMarketPrices,
  type MarketSort,
} from '@/lib/market/data';
import { cn } from '@/lib/utils';
import type { MarketPrice } from '@/types';

export function MarketPrices({
  prices,
  primaryCrops,
}: {
  prices: MarketPrice[];
  primaryCrops: string[];
}) {
  const [sort, setSort] = useState<MarketSort>('name');
  const sortId = useId();
  const sorted = sortMarketPrices(prices, sort);
  return (
    <Card className="rounded-3xl">
      <CardHeader className="flex-wrap items-center">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Store size={17} aria-hidden="true" className="text-ink-green" />
            Market Prices
          </CardTitle>
          <CardSub>Indicative prices across major Ghana markets</CardSub>
        </div>
        <AiChip>
          <Sparkles size={12} aria-hidden="true" />
          AI Forecast
        </AiChip>
      </CardHeader>
      <div className="border-border mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <p className="text-text-mute text-xs">{prices.length} crops · prices per listed unit</p>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-text-mute text-xs">
            Sort by
          </label>
          <Select
            id={sortId}
            value={sort}
            onChange={(event) => setSort(event.target.value as MarketSort)}
            className="min-h-9 py-1.5 text-xs"
          >
            <option value="name">Crop name</option>
            <option value="price">Price: high to low</option>
            <option value="change">Biggest change</option>
          </Select>
        </div>
      </div>
      <ul className="grid gap-2.5 @3xl:grid-cols-2">
        {sorted.map((price) => {
          const owned = isPrimaryCrop(price.crop, primaryCrops);
          const ChangeIcon =
            price.change > 0 ? ArrowUpRight : price.change < 0 ? ArrowDownRight : Minus;
          return (
            <li
              key={price.crop}
              className={cn(
                'flex min-w-0 items-center gap-3 rounded-2xl border p-3.5',
                owned ? 'border-accent/50 bg-accent/5' : 'border-border bg-bg-2/40',
              )}
            >
              <CropTile crop={cropFromName(price.crop)} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-text truncate text-sm font-semibold" title={price.crop}>
                    {price.crop}
                  </p>
                  {owned && <Badge className="px-2 text-[9px]">Your crop</Badge>}
                </div>
                <p className="text-text-mute mt-1 text-[11px]">{price.unit}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-text text-sm font-bold tabular-nums">{formatGHS(price.price)}</p>
                <p
                  className={cn(
                    'mt-1 flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums',
                    price.change > 0
                      ? 'text-ink-green'
                      : price.change < 0
                        ? 'text-ink-red'
                        : 'text-text-mute',
                  )}
                >
                  <ChangeIcon size={14} aria-hidden="true" />
                  <span className="sr-only">
                    {price.change > 0 ? 'Up ' : price.change < 0 ? 'Down ' : 'Unchanged '}
                  </span>
                  {formatPriceChange(price.change)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
