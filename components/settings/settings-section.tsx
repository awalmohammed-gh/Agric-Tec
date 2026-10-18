import type { ReactNode } from 'react';
import { SETTINGS_SECTIONS } from '@/components/settings/settings-sections';

/** One anchored group on the Profile & Settings page, with a small labelled heading. */
export function SettingsSection({
  id,
  description,
  children,
}: {
  id: string;
  description: string;
  children: ReactNode;
}) {
  const meta = SETTINGS_SECTIONS.find((s) => s.id === id);
  const Icon = meta?.icon;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-20 min-[900px]:scroll-mt-28"
    >
      <div className="mb-3 flex items-baseline justify-between gap-3 px-1">
        <h2
          id={`${id}-heading`}
          className="text-text-mute flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase"
        >
          {Icon && <Icon size={13} aria-hidden="true" className="text-ink-green" />}
          {meta?.label ?? id}
        </h2>
        <p className="text-text-mute hidden text-xs sm:block">{description}</p>
      </div>
      {children}
    </section>
  );
}
