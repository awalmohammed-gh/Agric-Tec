import { BASE_YIELD_PER_ACRE, PRICE_PER_TONNE, YIELD_MULTIPLIERS } from '@/constants/crops';
import type { YieldInput, YieldResult } from '@/types';

const round2 = (value: number) => Math.round(value * 100) / 100;

function baseYield(crop: YieldInput['crop']): number {
  return crop === 'Other' ? 0 : BASE_YIELD_PER_ACRE[crop];
}

function pricePerTonne(crop: YieldInput['crop']): number {
  return crop === 'Other' ? 0 : PRICE_PER_TONNE[crop];
}

/** Deterministic yield prediction: the same input always gives the same output. */
export function predictYield(input: YieldInput): YieldResult {
  const { fertilizer, irrigation, season } = YIELD_MULTIPLIERS;
  const perAcre =
    baseYield(input.crop) *
    fertilizer[input.fertilizer] *
    irrigation[input.irrigation] *
    season[input.season];
  const expected = perAcre * input.acres;
  const price = pricePerTonne(input.crop);

  return {
    low: round2(expected * 0.9),
    expected: round2(expected),
    high: round2(expected * 1.1),
    perAcre: round2(perAcre),
    revenue: Math.round(expected * price),
    pricePerTonne: price,
  };
}

/** One line of advice: praise strong management, or name the single biggest improvement. */
export function yieldInsight(input: YieldInput, result: YieldResult): string {
  const base = baseYield(input.crop);
  if (base === 0) {
    return 'We do not have baseline yield data for this crop yet. Record your harvests to build your own benchmark.';
  }
  if (result.perAcre > base * 1.2) {
    return `Excellent management! Your inputs put you about ${Math.round((result.perAcre / base - 1) * 100)}% above the average yield for ${input.crop}.`;
  }

  const { fertilizer, irrigation, season } = YIELD_MULTIPLIERS;
  const options = [
    {
      gain: fertilizer.both / fertilizer[input.fertilizer],
      advice: 'Using both organic and inorganic fertilizer',
    },
    {
      gain: irrigation.drip / irrigation[input.irrigation],
      advice: 'Adding drip irrigation',
    },
    {
      gain: season.major / season[input.season],
      advice: 'Planting in the major season (Mar–Jul)',
    },
  ];
  const best = options.reduce((top, option) => (option.gain > top.gain ? option : top));

  if (best.gain <= 1) {
    return 'Your inputs are already well optimized. Focus on timely weeding and pest control.';
  }
  return `${best.advice} could raise yield by about ${Math.round((best.gain - 1) * 100)}%.`;
}
