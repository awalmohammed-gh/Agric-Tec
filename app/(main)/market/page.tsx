import type { Metadata } from 'next';
import { DemoDataNotice } from '@/components/market/demo-data-notice';
import { MarketView } from '@/components/market/market-view';

export const metadata: Metadata = { title: 'Market & Weather' };

export default function MarketPage() {
  return (
    <div className="@container space-y-6">
      <DemoDataNotice />
      <MarketView />
    </div>
  );
}
