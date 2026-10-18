import type { Metadata } from 'next';
import { Wheat } from 'lucide-react';
import { AiBanner } from '@/components/ui/ai-banner';
import { YieldForm } from '@/components/yield-predictor/yield-form';

export const metadata: Metadata = { title: 'AI Yield Predictor' };

export default function YieldPredictorPage() {
  return (
    <div className="@container space-y-6">
      <AiBanner
        icon={Wheat}
        title="AgriCtec AI Yield Predictor"
        subtitle="Plan your next harvest with a repeatable yield estimate, an indicative revenue range and tips for your crop."
        className="rounded-3xl"
      />
      <YieldForm />
    </div>
  );
}
