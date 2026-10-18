'use client';

import { Sparkles } from 'lucide-react';
import { AiChip } from '@/components/ui/ai-chip';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { InsightItem } from '@/components/ui/insight-item';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { getRecommendations } from '@/lib/ai/recommendations';

export function AiRecommendations() {
  const stats = useFarmStats();
  const recommendations = getRecommendations(stats);

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Recommendations</CardTitle>
        <AiChip>
          <Sparkles size={12} aria-hidden="true" /> Powered by AgriCtec AI
        </AiChip>
      </CardHeader>
      {recommendations.length === 0 ? (
        <p className="text-text-dim text-sm">
          You&apos;re all set. Keep recording to keep your financial identity up to date.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recommendations.map((item) => (
            <InsightItem key={item.id} icon={item.icon} title={item.title}>
              {item.text}
            </InsightItem>
          ))}
        </div>
      )}
    </Card>
  );
}
