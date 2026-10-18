import { Check, ClipboardCheck, RotateCcw, Save, ShieldAlert, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { DiagnosisResult, Severity } from '@/types';

export const SEVERITY_COLORS = { High: 'red', Moderate: 'gold', None: 'green' } as const;
const severityBorder: Record<Severity, string> = {
  High: 'border-l-danger',
  Moderate: 'border-l-warning',
  None: 'border-l-accent',
};

export function DiagnosisCard({
  result,
  saving,
  saved,
  onSave,
  onScanAnother,
}: {
  result: DiagnosisResult;
  saving: boolean;
  saved: boolean;
  onSave: () => void;
  onScanAnother: () => void;
}) {
  return (
    <div className={cn('glass rounded-2xl border-l-4 p-5', severityBorder[result.severity])}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge color="purple">
          <Stethoscope size={11} aria-hidden="true" />
          Mock result
        </Badge>
        <Badge color={SEVERITY_COLORS[result.severity]}>
          {result.severity === 'None' ? 'No issue in sample' : `${result.severity} severity`}
        </Badge>
      </div>
      <h4 className="font-display text-text text-2xl font-bold">{result.disease}</h4>
      {result.crop && <p className="text-text-mute mt-1 text-xs">{result.crop}</p>}
      <Progress value={result.confidence} label="AI Confidence" className="mt-5" />
      <div className="border-border mt-5 border-t pt-4">
        <h5 className="text-text flex items-center gap-2 text-sm font-bold">
          <ClipboardCheck size={16} aria-hidden="true" className="text-ink-green" />
          Recommended Treatment
        </h5>
        <p className="text-text-dim mt-2 text-sm leading-relaxed">{result.treatment}</p>
      </div>
      <div className="bg-gold/10 text-ink-gold mt-4 flex gap-2 rounded-xl p-3 text-xs leading-relaxed">
        <ShieldAlert size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
        <p>
          AI diagnosis is a guide. Confirm with your MoFA extension officer before applying
          chemicals.
        </p>
      </div>
      <p className="text-text-mute mt-3 text-[11px] leading-relaxed">
        This result is a deterministic demo and does not assess the health of the uploaded plant.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button icon={saved ? Check : Save} loading={saving} disabled={saved} onClick={onSave}>
          {saved ? 'Diagnosis saved' : 'Save Diagnosis'}
        </Button>
        <Button variant="ghost" icon={RotateCcw} disabled={saving} onClick={onScanAnother}>
          Scan another
        </Button>
      </div>
    </div>
  );
}
