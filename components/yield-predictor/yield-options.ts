import {
  CloudRain,
  CloudSun,
  Droplet,
  FlaskConical,
  Layers,
  Leaf,
  Sprout,
  Sun,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import { BASE_YIELD_PER_ACRE, YIELD_MULTIPLIERS } from '@/constants/crops';
import type { YieldInput } from '@/types';

export interface YieldOption<T extends string> {
  value: T;
  label: string;
  hint: string;
  icon: LucideIcon;
}

export const SEASON_OPTIONS: YieldOption<YieldInput['season']>[] = [
  { value: 'major', label: 'Major season', hint: 'Mar – Jul', icon: Sun },
  { value: 'minor', label: 'Minor season', hint: 'Aug – Dec', icon: CloudSun },
];

export const FERTILIZER_OPTIONS: YieldOption<YieldInput['fertilizer']>[] = [
  { value: 'both', label: 'Both', hint: 'Organic + inorganic', icon: Layers },
  { value: 'inorganic', label: 'Inorganic', hint: 'NPK, urea', icon: FlaskConical },
  { value: 'organic', label: 'Organic', hint: 'Manure, compost', icon: Leaf },
  { value: 'none', label: 'None', hint: 'No fertilizer', icon: Sprout },
];

export const IRRIGATION_OPTIONS: YieldOption<YieldInput['irrigation']>[] = [
  { value: 'rainfed', label: 'Rainfed', hint: 'Natural rainfall', icon: CloudRain },
  { value: 'drip', label: 'Drip', hint: 'Water at the roots', icon: Droplet },
  { value: 'sprinkler', label: 'Sprinkler', hint: 'Overhead spray', icon: Waves },
];

export const ACRE_PRESETS = [1, 2, 5, 10] as const;

/** Percentage boost a multiplier adds over the baseline, e.g. 1.35 → 35. */
export const boostPercent = (multiplier: number) => Math.round((multiplier - 1) * 100);

/** Combined multiplier of the chosen inputs against the best possible combination. */
export function inputStrength(input: Pick<YieldInput, 'season' | 'fertilizer' | 'irrigation'>) {
  const { fertilizer, irrigation, season } = YIELD_MULTIPLIERS;
  const current =
    fertilizer[input.fertilizer] * irrigation[input.irrigation] * season[input.season];
  const best = fertilizer.both * irrigation.drip * season.major;
  return { current, best, boost: boostPercent(current), share: (current - 1) / (best - 1) };
}

/** Per-acre yield with no inputs (average farm) and with the best inputs. */
export function perAcreBenchmarks(crop: Exclude<YieldInput['crop'], 'Other'>) {
  const base = BASE_YIELD_PER_ACRE[crop];
  const { best } = inputStrength({ season: 'minor', fertilizer: 'none', irrigation: 'rainfed' });
  return { base, best: base * best };
}
