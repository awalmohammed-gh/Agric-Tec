'use client';

import { AlertTriangle, CheckCircle2, TrendingUp, TriangleAlert } from 'lucide-react';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Card, CardHeader, CardSub, CardTitle } from '@/components/ui/card';
import { InsightItem } from '@/components/ui/insight-item';
import { ScoreRing } from '@/components/ui/score-ring';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { formatGHS } from '@/lib/format';

function band(health: number): { label: string; color: BadgeColor } {
  if (health >= 80) return { label: 'Healthy', color: 'green' };
  if (health >= 60) return { label: 'Fair', color: 'gold' };
  return { label: 'Needs attention', color: 'red' };
}

/** Financial health (20–100) with two data-driven insights. */
export function HealthCard() {
  const { health, profit, margin, hasData } = useFarmStats();
  const { label, color } = band(health);
  const profitable = profit > 0;
  const strongMargin = margin >= 20;

  return (
    <Card className="@container flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Financial Health</CardTitle>
          <CardSub>Profitability and record keeping</CardSub>
        </div>
        <Badge color={color}>{label}</Badge>
      </CardHeader>

      <div className="flex flex-1 flex-col items-center gap-5 @md:flex-row @md:items-center">
        <ScoreRing value={health} max={100} label="Health score" size={140} />
        <div className="w-full min-w-0 flex-1 space-y-3">
          {!hasData ? (
            <InsightItem icon={TriangleAlert} title="No data yet">
              Add records or load sample data to see your financial health.
            </InsightItem>
          ) : (
            <>
              <InsightItem
                icon={profitable ? CheckCircle2 : AlertTriangle}
                title={profitable ? 'Your farm is profitable' : 'Your farm is running at a loss'}
              >
                {profitable
                  ? `You kept ${formatGHS(profit)} after costs. Lenders look for exactly this.`
                  : `Costs are ${formatGHS(Math.abs(profit))} above income. Review your largest expenses.`}
              </InsightItem>
              <InsightItem
                icon={strongMargin ? TrendingUp : AlertTriangle}
                title={
                  strongMargin ? `Margin above 20% (${margin}%)` : `Margin below 20% (${margin}%)`
                }
              >
                {strongMargin
                  ? 'A healthy margin shows you can repay a loan comfortably.'
                  : 'Aim for at least 20% so a loan repayment fits your cash flow.'}
              </InsightItem>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
