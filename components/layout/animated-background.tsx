/**
 * Two fixed decorative layers behind the whole app: colour blobs and a faint grid.
 * Deliberately static: an animated filter here repainted the full screen and re-blurred the
 * sidebar and top bar on every frame (one style recalculation per frame, even when idle).
 */
export function AnimatedBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--bg-1)',
          backgroundImage: [
            'radial-gradient(circle at 20% 20%, rgba(16, 185, 129, 0.18), transparent 45%)',
            'radial-gradient(circle at 80% 10%, rgba(168, 85, 247, 0.16), transparent 45%)',
            'radial-gradient(circle at 50% 80%, rgba(59, 130, 246, 0.14), transparent 50%)',
          ].join(', '),
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        }}
      />
    </div>
  );
}
