import { z } from 'zod';
import { CROPS } from '@/constants/crops';
import { REGIONS } from '@/constants/regions';
import { ghanaPhone } from '@/lib/profile';

export const personalSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(160),
  phone: z
    .string()
    .trim()
    .regex(ghanaPhone, 'Enter a valid Ghana number, e.g. 0244123456')
    .or(z.literal('')),
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  region: z.enum(REGIONS),
});
export const farmSchema = z.object({
  farmName: z.string().trim().max(80),
  acres: z.coerce.number({ error: 'Enter a valid acreage' }).min(0).max(10000),
  farmType: z.enum(['Smallholder', 'Commercial', 'Cooperative']),
  primaryCrops: z.array(z.enum(CROPS)).max(5, 'Choose up to 5 crops'),
});
export type PersonalValues = z.output<typeof personalSchema>;
export type FarmInput = z.input<typeof farmSchema>;
export type FarmValues = z.output<typeof farmSchema>;
