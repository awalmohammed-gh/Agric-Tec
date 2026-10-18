import type { Metadata } from 'next';
import { CropDistributionChart } from '@/components/records/crop-distribution-chart';
import { MonthlyNetChart } from '@/components/records/monthly-net-chart';
import { RecordsView } from '@/components/records/records-view';

export const metadata: Metadata = { title: 'Farm Records' };

export default function RecordsPage() {
  return (
    <div className="space-y-6">
      <RecordsView />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <CropDistributionChart />
        <MonthlyNetChart />
      </div>
    </div>
  );
}
