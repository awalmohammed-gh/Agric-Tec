import type { Metadata } from 'next';
import { MarketPricesEditor } from '@/components/admin/content/market-prices-editor';
import { WeatherOverride } from '@/components/admin/content/weather-override';
import { PageHeader } from '@/components/admin/layout/page-header';
import { RequirePermission } from '@/components/admin/layout/require-permission';

export const metadata: Metadata = { title: 'Market & Weather' };

/** Market prices and the weather override. Guarded by content.manage (checked again on save). */
export default function MarketContentPage() {
  return (
    <RequirePermission permission="content.manage">
      <PageHeader
        title="Market & weather"
        description="The prices and weather farmers see. Saved changes reach the farmer app at once."
      />
      <div className="space-y-6">
        <MarketPricesEditor />
        <WeatherOverride />
      </div>
    </RequirePermission>
  );
}
