import { Bug, ChartNoAxesCombined, CloudSun, Languages, Sprout, Wallet } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { InsightItem } from '@/components/ui/insight-item';

export function CapabilitiesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How I can help</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        <InsightItem icon={Sprout} title="Crop Advisory">
          Planting seasons, fertilizer guidance and cassava care.
        </InsightItem>
        <InsightItem icon={Bug} title="Pest & Disease">
          Spot pest damage early and understand control options.
        </InsightItem>
        <InsightItem icon={CloudSun} title="Weather Intelligence">
          Simulated weather with practical farm advice.
        </InsightItem>
        <InsightItem icon={Wallet} title="Financial Planning">
          Understand your farm profit and credit score.
        </InsightItem>
        <InsightItem icon={ChartNoAxesCombined} title="Market Analysis">
          Indicative cocoa prices and tips for selling.
        </InsightItem>
        <InsightItem icon={Languages} title="Multilingual">
          English available. Twi, Ga and Ewe — coming soon.
        </InsightItem>
      </div>
      <p className="text-text-mute mt-4 text-xs leading-relaxed">
        Replies are rule-based for now. For advice specific to your field, contact your local MoFA
        extension officer.
      </p>
    </Card>
  );
}
