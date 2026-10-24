'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Radar } from 'lucide-react';
import { toast } from 'sonner';
import { PRIMARY_CLASS } from '@/components/admin/shared/action-styles';
import { Button } from '@/components/ui/button';
import { RISK_RULES } from '@/lib/admin/risk-rules';
import { riskService } from '@/services/admin/risk.service';
import type { RiskFlag } from '@/types/admin';

const STEPS = [
  'Reading every farmer’s records and MoMo transactions…',
  `Checking ${RISK_RULES.length} rules across accounts…`,
  'Comparing with flags already found…',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * "Run scan now": runs every rule over every farmer (audited) with visible progress, then says
 * how many new flags it found. Findings already flagged (in any status) are never added again.
 */
export function ScanButton({ onDone }: { onDone: (found: RiskFlag[]) => void }) {
  const [step, setStep] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function scan() {
    setResult(null);
    try {
      // The rules are fast; the steps are paced so staff can see what the scan does.
      for (let i = 0; i < STEPS.length - 1; i++) {
        setStep(i);
        await wait(450);
      }
      setStep(STEPS.length - 1);
      const found = await riskService.runScan();
      if (!mounted.current) return;
      const message =
        found.length === 0
          ? 'Scan complete: no new flags'
          : `Scan complete: ${found.length} new flag${found.length === 1 ? '' : 's'}`;
      setResult(message);
      toast.success(message);
      onDone(found);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'The scan could not run');
    } finally {
      if (mounted.current) setStep(null);
    }
  }

  const running = step !== null;
  const percent = running ? Math.round(((step + 1) / STEPS.length) * 100) : 0;

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <Button icon={Radar} loading={running} onClick={() => void scan()} className={PRIMARY_CLASS}>
        {running ? 'Scanning…' : 'Run scan now'}
      </Button>
      <div aria-live="polite" className="min-h-5 text-xs sm:text-right">
        {running ? (
          <span className="flex flex-col gap-1.5 sm:items-end">
            <span className="text-text-dim">{STEPS[step]}</span>
            <span
              role="progressbar"
              aria-label="Scan progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="bg-glass-strong block h-1 w-full overflow-hidden rounded-full sm:w-56"
            >
              <span
                className="bg-purple block h-full rounded-full transition-[width] duration-300"
                style={{ width: `${percent}%` }}
              />
            </span>
          </span>
        ) : (
          result && (
            <span className="text-ink-green inline-flex items-center gap-1.5 font-semibold">
              <CheckCircle2 size={14} aria-hidden="true" />
              {result}
            </span>
          )
        )}
      </div>
    </div>
  );
}
