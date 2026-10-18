import type { Metadata } from 'next';
import { MomoFlowChart } from '@/components/momo/momo-flow-chart';
import { MomoStats } from '@/components/momo/momo-stats';
import { MomoView } from '@/components/momo/momo-view';

export const metadata: Metadata = { title: 'MoMo Transactions' };

export default function MomoPage() {
  return (
    <div className="space-y-6">
      <MomoStats />
      <MomoView />
      <MomoFlowChart />
    </div>
  );
}
