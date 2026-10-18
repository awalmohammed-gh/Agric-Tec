'use client';

import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { AiBanner } from '@/components/ui/ai-banner';
import { Button } from '@/components/ui/button';
import { useFarmStats } from '@/hooks/use-farm-stats';
import { getDailyInsight } from '@/lib/ai/recommendations';
import { useModalStore } from '@/store/modal-store';

const ROTATE_MS = 15_000;

export function InsightBanner() {
  const stats = useFarmStats();
  const openModal = useModalStore((s) => s.openModal);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!stats.hasData) return;
    const timer = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(timer); // no leak when leaving the page
  }, [stats.hasData]);

  const text = stats.hasData
    ? getDailyInsight(stats, index)
    : 'Welcome to AgriCtec! Add your first farm record and our AI will start analysing your income, costs and loan readiness.';

  return (
    <AiBanner
      icon={Sparkles}
      title="AI Insight of the Day"
      // The key re-mounts the text so each new insight fades in.
      subtitle={
        <span key={index} className="animate-fade-in block">
          {text}
        </span>
      }
      action={
        <Button size="sm" onClick={() => openModal('record')}>
          Add Record →
        </Button>
      }
    />
  );
}
