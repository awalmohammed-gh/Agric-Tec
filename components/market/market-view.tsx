'use client';

import { useEffect, useState } from 'react';
import { CloudOff, RotateCcw } from 'lucide-react';
import { MarketPrices } from '@/components/market/market-prices';
import { PriceTrendChart } from '@/components/market/price-trend-chart';
import { WeatherAdvisory } from '@/components/market/weather-advisory';
import { WeatherCard } from '@/components/market/weather-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { locationLabel } from '@/lib/profile';
import { marketService, type WeatherSnapshot } from '@/services/market.service';
import { useProfileStore } from '@/store/profile-store';
import type { MarketPrice, PriceTrends } from '@/types';

type MarketState =
  | { status: 'loading' | 'error' }
  | { status: 'ready'; weather: WeatherSnapshot; prices: MarketPrice[]; trends: PriceTrends };
const TREND_CROPS = ['Maize', 'Rice', 'Cocoa', 'Groundnut'];

export function MarketView() {
  const profile = useProfileStore((state) => state.profile);
  const [state, setState] = useState<MarketState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      marketService.getWeather(),
      marketService.getPrices(),
      marketService.getPriceTrends(TREND_CROPS, 6),
    ]).then(
      ([weather, prices, trends]) => {
        if (active) setState({ status: 'ready', weather, prices, trends });
      },
      () => {
        if (active) setState({ status: 'error' });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state.status === 'loading') return <MarketSkeleton />;
  if (state.status === 'error')
    return (
      <Card className="rounded-3xl">
        <EmptyState
          icon={CloudOff}
          title="Market data couldn’t load"
          description="Try loading your weather and market information again."
          action={
            <Button
              icon={RotateCcw}
              onClick={() => {
                setState({ status: 'loading' });
                setAttempt((value) => value + 1);
              }}
            >
              Try again
            </Button>
          }
        />
      </Card>
    );
  // A single loaded snapshot feeds both weather cards and both market views.
  if (state.status !== 'ready') return null;
  const primaryCrops = profile?.primaryCrops ?? [];
  return (
    <>
      <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2">
        {/* "<Constituency>, <Region>" (the card adds ", Ghana"). */}
        <WeatherCard
          weather={state.weather}
          region={profile ? locationLabel(profile) : undefined}
        />
        <WeatherAdvisory
          weather={state.weather}
          primaryCrops={primaryCrops}
          prices={state.prices}
        />
      </div>
      <MarketPrices prices={state.prices} primaryCrops={primaryCrops} />
      <PriceTrendChart trends={state.trends} prices={state.prices} />
    </>
  );
}

function MarketSkeleton() {
  return (
    <div role="status" aria-label="Loading market and weather" className="space-y-6">
      <div className="grid gap-5 @3xl:grid-cols-2">
        {[0, 1].map((index) => (
          <Card key={index} className="rounded-3xl">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-6 h-56 rounded-2xl" />
          </Card>
        ))}
      </div>
      <Card className="rounded-3xl">
        <Skeleton className="h-5 w-48" />
        <div className="mt-5 grid gap-3 @3xl:grid-cols-2">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </Card>
      <Card className="rounded-3xl">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="mt-6 h-72 rounded-2xl" />
      </Card>
    </div>
  );
}
