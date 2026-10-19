import { Bot, CloudSun, Sparkles, Sprout, Wallet } from 'lucide-react';

export function AssistantHero() {
  return (
    <section
      aria-labelledby="assistant-hero-title"
      className="border-border bg-glass shadow-glass relative overflow-hidden rounded-3xl border p-6 backdrop-blur-xl sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -right-20 size-96 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.18),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-48 left-1/3 size-96 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12),transparent_70%)]"
      />
      <div className="relative flex items-center justify-between gap-8">
        <div className="max-w-xl">
          <span className="border-purple/30 bg-purple/10 text-ink-purple inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold">
            <Sparkles size={13} aria-hidden="true" /> AgriCtec AI Agronomist
          </span>
          <h2
            id="assistant-hero-title"
            className="font-display text-text mt-4 text-3xl leading-tight font-bold @xl:text-4xl"
          >
            A little guidance.
            <br />
            <span className="text-gradient-brand">A better growing season.</span>
          </h2>
          <p className="text-text-dim mt-3 max-w-lg text-sm leading-relaxed">
            From your first seedlings to your next sale. Get practical answers shaped around your
            farm.
          </p>
        </div>
        <div aria-hidden="true" className="hidden shrink-0 items-center gap-5 @4xl:flex">
          <div className="border-accent/20 from-accent/15 to-accent/5 relative flex size-24 items-center justify-center rounded-3xl border bg-linear-to-br">
            <div className="border-accent/10 absolute -inset-3 rounded-[2rem] border" />
            <Bot size={42} strokeWidth={1.4} className="text-ink-green" />
            <span className="border-border bg-glass-strong text-ink-green absolute -right-3 -bottom-3 flex size-9 items-center justify-center rounded-xl border shadow-sm">
              <Sparkles size={17} />
            </span>
          </div>
          <div className="space-y-3.5 pl-2">
            {[
              { icon: Sprout, label: 'Grow with confidence' },
              { icon: CloudSun, label: 'Plan for the season' },
              { icon: Wallet, label: 'Understand your finances' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="text-text-dim flex items-center gap-2.5 text-xs">
                <Icon size={15} className="text-ink-green" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
