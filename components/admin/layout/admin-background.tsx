/**
 * The farmer app's static backdrop, tinted purple and gold so staff always know they are in
 * the admin console. Static on purpose, like AnimatedBackground (no per-frame repaints).
 */
export function AdminBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'var(--bg-1)',
          backgroundImage: [
            'radial-gradient(circle at 15% 15%, rgba(168, 85, 247, 0.22), transparent 45%)',
            'radial-gradient(circle at 85% 10%, rgba(245, 196, 81, 0.16), transparent 45%)',
            'radial-gradient(circle at 50% 85%, rgba(124, 58, 237, 0.14), transparent 50%)',
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
