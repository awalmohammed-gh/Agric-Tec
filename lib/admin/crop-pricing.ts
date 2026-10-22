// Links the market page's prices to the crop data behind the yield predictor (phase A12): the
// crops page shows each crop's market price per tonne and can copy it over in one click.

import type { MarketPrice } from '@/types';

/** Kilograms in one market unit ("100kg bag" → 100, "tonne" → 1000); null when not a weight. */
export function kgPerUnit(unit: string): number | null {
  const u = unit.trim().toLowerCase();
  const kg = u.match(/(\d+(?:\.\d+)?)\s*kg\b/);
  if (kg) return Number(kg[1]) > 0 ? Number(kg[1]) : null;
  if (/^(1\s*)?(t|tonnes?|tons?|metric tons?)$/.test(u)) return 1000;
  return null;
}

export interface MarketReference {
  row: MarketPrice;
  /** The market price per tonne, or null when the unit isn't a weight ("bunch", "basket"). */
  perTonne: number | null;
}

/** The market page row for a crop ("Rice (local)" counts for Rice), with its price per tonne. */
export function marketReference(crop: string, prices: MarketPrice[]): MarketReference | null {
  const name = crop.trim().toLowerCase();
  const row = prices.find((p) => {
    const label = p.crop.trim().toLowerCase();
    return label === name || label.startsWith(`${name} `) || label.startsWith(`${name}(`);
  });
  if (!row) return null;
  const kg = kgPerUnit(row.unit);
  return { row, perTonne: kg ? Math.round((row.price * 1000) / kg) : null };
}
