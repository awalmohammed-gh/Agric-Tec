import { z } from 'zod';
import { CROPS } from '@/constants/crops';
import type { Crop } from '@/types';

export const YIELD_CROPS = CROPS.filter((crop): crop is Exclude<Crop, 'Other'> => crop !== 'Other');

export const yieldSchema = z.object({
  crop: z.enum(YIELD_CROPS),
  acres: z.coerce
    .number({ error: 'Enter your acreage' })
    .min(0.1, 'Minimum 0.1 acres')
    .max(1000, 'Maximum 1000 acres'),
  season: z.enum(['major', 'minor']),
  fertilizer: z.enum(['both', 'inorganic', 'organic', 'none']),
  irrigation: z.enum(['rainfed', 'drip', 'sprinkler']),
});

export type YieldFormInput = z.input<typeof yieldSchema>;
export type YieldFormValues = z.output<typeof yieldSchema>;
