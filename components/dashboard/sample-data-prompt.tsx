'use client';

import { useState } from 'react';
import { Database } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { useFarmStore } from '@/store/farm-store';
import { useUiStore } from '@/store/ui-store';

export function SampleDataPrompt() {
  const { hasData } = useFarmStats();
  const loadSampleData = useFarmStore((s) => s.loadSampleData);
  const dismissed = useUiStore((s) => s.samplePromptDismissed);
  const dismiss = useUiStore((s) => s.dismissSamplePrompt);
  const [loading, setLoading] = useState(false);

  if (hasData || dismissed) return null;

  async function handleLoad() {
    setLoading(true);
    try {
      await loadSampleData();
      toast.success('Sample data loaded. Explore your dashboard!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load sample data');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-accent/30 flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="bg-accent/15 text-ink-green inline-flex size-12 shrink-0 items-center justify-center rounded-2xl">
        <Database size={22} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-text text-base font-bold">
          New here? Load sample data to explore the app
        </h2>
        <p className="text-text-dim mt-1 text-sm">
          Adds 12 farm records and 6 MoMo transactions from the last 6 months. You can delete them
          anytime.
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button onClick={handleLoad} loading={loading}>
          Load sample data
        </Button>
        <Button variant="ghost" onClick={dismiss} disabled={loading}>
          Start fresh
        </Button>
      </div>
    </Card>
  );
}
