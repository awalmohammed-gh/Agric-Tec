// Temporary design-system test page. Replaced in Phase 5.

const swatches = [
  { name: 'Accent', className: 'bg-accent' },
  { name: 'Gold', className: 'bg-gold' },
  { name: 'Danger', className: 'bg-danger' },
  { name: 'Info', className: 'bg-info' },
  { name: 'Purple', className: 'bg-purple' },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-4 py-16">
      <h1 className="text-gradient-brand animate-fade-in font-display text-6xl font-black tracking-tight sm:text-7xl">
        AgriCtec
      </h1>

      <section className="glass animate-fade-in w-full rounded-card p-8 shadow-glass">
        <h2 className="font-display text-2xl font-bold text-text">Design system check</h2>
        <p className="mt-3 text-text">Primary text: headings and body copy.</p>
        <p className="mt-2 text-text-dim">Dim text: secondary information and descriptions.</p>
        <p className="mt-2 text-text-mute">Muted text: hints, captions and placeholders.</p>

        <ul className="mt-8 flex flex-wrap gap-4">
          {swatches.map((swatch) => (
            <li key={swatch.name} className="flex flex-col items-center gap-2">
              <span
                className={`block size-14 rounded-xl border border-border ${swatch.className}`}
                aria-hidden="true"
              />
              <span className="text-xs text-text-dim">{swatch.name}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
