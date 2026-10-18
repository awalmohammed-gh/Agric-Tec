import type { Metadata } from 'next';
import { YieldForm } from '@/components/yield-predictor/yield-form';
import { YieldHero } from '@/components/yield-predictor/yield-hero';

export const metadata: Metadata = { title: 'AI Yield Predictor' };

export default function YieldPredictorPage() {
  return (
    <div className="@container space-y-6">
      <YieldHero />
      <YieldForm />
    </div>
  );
}
