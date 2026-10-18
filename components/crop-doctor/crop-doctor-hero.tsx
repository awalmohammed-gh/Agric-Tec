'use client';

import {
  Camera,
  Leaf,
  Lock,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useFarmStore } from '@/store/farm-store';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Camera, title: 'Snap', text: 'Photo of the affected leaf' },
  { icon: ScanLine, title: 'Analyze', text: 'AI checks for disease signs' },
  { icon: Stethoscope, title: 'Treat', text: 'Get a step-by-step plan' },
];

/** Decorative scanner: a leaf inside viewfinder corners with a sweeping scan line. */
function ScannerVisual() {
  const corner = 'absolute size-7 border-[#34d399]';
  return (
    <div aria-hidden="true" className="relative mx-auto size-56">
      <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle,rgba(16,185,129,0.25),transparent_70%)]" />
      <div className="border-border bg-bg-2/70 absolute inset-6 overflow-hidden rounded-3xl border backdrop-blur">
        <Leaf
          size={120}
          strokeWidth={1}
          className="text-ink-green absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80"
        />
        {/* "Detected" spots */}
        <span className="absolute top-[38%] left-[34%] size-3 rounded-full bg-[#f5c451] shadow-[0_0_12px_#f5c451]" />
        <span className="absolute top-[55%] left-[58%] size-2.5 rounded-full bg-[#ef4444] shadow-[0_0_12px_#ef4444]" />
        <span className="animate-scan-sweep absolute inset-x-0 h-0.5 bg-[#34d399] shadow-[0_0_20px_6px_rgba(52,211,153,0.45)]" />
      </div>
      <span className={`${corner} top-3 left-3 rounded-tl-2xl border-t-[3px] border-l-[3px]`} />
      <span className={`${corner} top-3 right-3 rounded-tr-2xl border-t-[3px] border-r-[3px]`} />
      <span className={`${corner} bottom-3 left-3 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
      <span className={`${corner} right-3 bottom-3 rounded-br-2xl border-r-[3px] border-b-[3px]`} />
      <span className="border-gold/40 bg-bg-2 text-ink-gold absolute top-10 -right-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-lg">
        Leaf spots
      </span>
      <span className="border-accent/40 bg-bg-2 text-ink-green absolute bottom-12 -left-3 rounded-full border px-2.5 py-1 text-[10px] font-semibold shadow-lg">
        94% match
      </span>
    </div>
  );
}

export function CropDoctorHero() {
  const diagnoses = useFarmStore((s) => s.diagnoses);
  const issues = diagnoses.filter((d) => d.severity !== 'None').length;
  const latest = diagnoses[0];

  const stats = [
    { label: 'Scans saved', value: String(diagnoses.length) },
    { label: 'Issues found', value: String(issues) },
    { label: 'Last scan', value: latest ? formatDate(latest.date) : 'None yet' },
  ];

  return (
    <section
      aria-labelledby="crop-doctor-title"
      className="border-border bg-glass shadow-glass @container relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.16),transparent_70%)]"
      />
      <div className="relative grid items-center gap-8 @3xl:grid-cols-[minmax(0,1fr)_260px]">
        <div>
          <span className="border-purple/30 bg-purple/10 text-ink-purple inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
            <Sparkles size={13} aria-hidden="true" /> AI Crop Doctor
          </span>
          <h2
            id="crop-doctor-title"
            className="font-display text-text mt-4 text-3xl leading-tight font-bold @xl:text-4xl"
          >
            Spot crop problems <span className="text-gradient-brand">before they spread</span>
          </h2>
          <p className="text-text-dim mt-3 max-w-xl text-sm @xl:text-base">
            Take a photo of a sick leaf and get a likely diagnosis with a treatment plan in seconds.
          </p>

          <ol className="mt-6 grid grid-cols-1 gap-3 @md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className="border-border bg-glass flex items-center gap-3 rounded-2xl border px-3.5 py-3"
              >
                <span className="bg-accent/15 text-ink-green relative inline-flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Icon size={18} aria-hidden="true" />
                  <span className="absolute -top-1.5 -right-1.5 inline-flex size-5 items-center justify-center rounded-full bg-[#10b981] text-[10px] font-bold text-[#022c22]">
                    {i + 1}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="text-text block text-sm font-bold">{title}</span>
                  <span className="text-text-mute block text-xs">{text}</span>
                </span>
              </li>
            ))}
          </ol>

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-text-mute text-[11px]">{s.label}</dt>
                <dd className="text-text text-sm font-bold">{s.value}</dd>
              </div>
            ))}
          </dl>

          <p className="text-text-mute mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5">
              <Lock size={12} aria-hidden="true" /> Photos stay on your device
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={12} aria-hidden="true" /> Results are simulated. Confirm with your
              extension officer.
            </span>
          </p>
        </div>

        <div className="hidden @3xl:block">
          <ScannerVisual />
        </div>
      </div>
    </section>
  );
}
