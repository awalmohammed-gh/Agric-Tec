import { Info } from 'lucide-react';

export function DemoDataNotice() {
  return (
    <div className="border-info/20 bg-info/5 text-text-dim flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-xs leading-relaxed">
      <Info size={16} aria-hidden="true" className="text-ink-blue mt-0.5 shrink-0" />
      <p>
        <span className="text-text font-semibold">Indicative prices and weather — demo data.</span>{' '}
        Live data sources will be connected in a future version.
      </p>
    </div>
  );
}
