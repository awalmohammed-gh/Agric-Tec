import { ScanLine, Sparkles } from 'lucide-react';

export function AnalyzingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-72 flex-col items-center justify-center px-4 py-10 text-center"
    >
      <span className="border-purple/20 bg-purple/10 text-ink-purple animate-pulse-soft mb-5 inline-flex size-16 items-center justify-center rounded-2xl border motion-reduce:animate-none">
        <ScanLine size={32} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="font-display text-text text-xl font-bold">Analyzing leaf patterns…</p>
      <p className="text-text-mute mt-2 max-w-xs text-xs leading-relaxed">
        Preparing a sample diagnosis and treatment guide for your crop.
      </p>
      <span className="text-ink-purple mt-5 inline-flex items-center gap-1.5 text-[11px]">
        <Sparkles size={13} aria-hidden="true" />
        Simulated analysis
      </span>
    </div>
  );
}
