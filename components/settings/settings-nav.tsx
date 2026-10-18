'use client';

import { useEffect, useState } from 'react';
import { SETTINGS_SECTIONS } from '@/components/settings/settings-sections';
import { cn } from '@/lib/utils';

/**
 * Jump links to each section. A horizontal, scrollable chip row on small screens and a
 * sticky vertical list beside the content on wide ones. The link of the section in view
 * is highlighted (one IntersectionObserver; state changes only when the section changes).
 */
export function SettingsNav() {
  const [active, setActive] = useState(SETTINGS_SECTIONS[0]?.id ?? '');

  useEffect(() => {
    const sections = SETTINGS_SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id);
      },
      // A band across the upper part of the screen decides which section is "current".
      { rootMargin: '-20% 0px -65% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  return (
    <nav aria-label="Settings sections" className="@5xl:sticky @5xl:top-28">
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 @5xl:mx-0 @5xl:flex-col @5xl:gap-1 @5xl:overflow-visible @5xl:px-0">
        {SETTINGS_SECTIONS.map(({ id, label, icon: Icon }) => {
          const current = active === id;
          return (
            <li key={id} className="shrink-0">
              <a
                href={`#${id}`}
                onClick={() => setActive(id)}
                aria-current={current ? 'location' : undefined}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-sm font-medium whitespace-nowrap transition-colors @5xl:rounded-xl',
                  current
                    ? 'border-accent/40 bg-accent/10 text-ink-green'
                    : 'border-border bg-glass text-text-dim hover:text-text @5xl:border-transparent @5xl:bg-transparent',
                )}
              >
                <Icon size={16} aria-hidden="true" className="shrink-0" />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
