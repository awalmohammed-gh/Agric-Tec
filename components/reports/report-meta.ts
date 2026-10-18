import { Calculator, Landmark, ReceiptText, TrendingUp, type LucideIcon } from 'lucide-react';
import type { ReportType } from '@/types';

export interface ReportMeta {
  icon: LucideIcon;
  description: string;
  /** Icon tile colours. */
  tone: string;
  /** Card hover border colour. */
  hoverBorder: string;
}

export const REPORT_ORDER: ReportType[] = ['income', 'expense', 'loan', 'tax'];

export const REPORT_META: Record<ReportType, ReportMeta> = {
  income: {
    icon: TrendingUp,
    description: 'Every sale, your best crop and income by crop.',
    tone: 'bg-linear-to-br from-[#10b981] to-[#34d399] text-white shadow-accent/40',
    hoverBorder: 'hover:border-accent/50',
  },
  expense: {
    icon: ReceiptText,
    description: 'All farm costs, grouped by category.',
    tone: 'bg-linear-to-br from-[#2563eb] to-[#60a5fa] text-white shadow-info/40',
    hoverBorder: 'hover:border-info/50',
  },
  loan: {
    icon: Landmark,
    description: 'Credit score, factors and an AI assessment for lenders.',
    tone: 'bg-linear-to-br from-[#9333ea] to-[#c084fc] text-white shadow-purple/40',
    hoverBorder: 'hover:border-purple/50',
  },
  tax: {
    icon: Calculator,
    description: 'This year’s gross income, deductible costs and monthly totals.',
    tone: 'bg-linear-to-br from-[#d97706] to-[#f5c451] text-white shadow-gold/40',
    hoverBorder: 'hover:border-gold/50',
  },
};
