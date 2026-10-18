'use client';

import { usePathname } from 'next/navigation';
import { Bell, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GlobalSearch } from '@/components/layout/global-search';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { isNavActive, NAV_SECTIONS, PAGE_META } from '@/constants/navigation';
import { cn } from '@/lib/utils';
import { navKey, useT } from '@/lib/i18n';

const iconButtonClass =
  'relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-text-dim transition-colors hover:bg-glass-strong hover:text-text';

interface PageInfo {
  title: string;
  subtitle: string;
  section: string | null;
  icon: LucideIcon | null;
}

/** Title, subtitle, nav section and icon for the current route (works for nested routes too). */
function pageInfo(pathname: string): PageInfo {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((i) => isNavActive(pathname, i.href));
    if (item) {
      const meta = PAGE_META[item.href];
      return {
        title: meta?.title ?? item.label,
        subtitle: meta?.subtitle ?? '',
        section: section.title,
        icon: item.icon,
      };
    }
  }
  return { title: 'AgriCtec', subtitle: '', section: null, icon: null };
}

/**
 * Top bar. Below 900px: a full-width, opaque bar stuck to the top of the page (no blur,
 * no scroll effects, so it cannot jitter). From 900px: the floating glass bar, which turns
 * more solid on scroll through a CSS scroll-driven animation (no scroll listener or re-renders).
 * The title block re-animates on every navigation.
 */
export function Topbar() {
  const pathname = usePathname();
  const t = useT();
  const { title, subtitle, section, icon: Icon } = pageInfo(pathname);

  return (
    <header className="sticky top-0 z-30 -mx-5 mb-6 min-[900px]:top-3 min-[900px]:mx-0 md:-mx-8">
      <div
        className={cn(
          'border-border bg-bg-2 flex items-center gap-2 border-b px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-2 sm:gap-3',
          'min-[900px]:topbar-glass min-[900px]:rounded-2xl min-[900px]:border min-[900px]:px-3 min-[900px]:py-2 min-[900px]:backdrop-blur-xl',
        )}
      >
        {/* key={pathname}: the whole block fades in again whenever the route changes */}
        <div key={pathname} className="animate-fade-in flex min-w-0 flex-1 items-center gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className="from-accent/25 to-accent/5 text-ink-green hidden size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br min-[360px]:inline-flex"
            >
              <Icon size={20} />
            </span>
          )}
          <div className="min-w-0">
            {section && (
              <p className="text-text-mute text-[10px] font-semibold tracking-wider uppercase min-[900px]:text-[11px]">
                {t(`nav.section.${section}`)}
              </p>
            )}
            <h1 className="font-display text-text truncate text-[15px] leading-tight font-bold min-[900px]:text-xl">
              {t(navKey(pathname)) === navKey(pathname) ? title : t(navKey(pathname))}
            </h1>
            {subtitle && (
              <p className="text-text-dim hidden truncate text-xs lg:block">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <GlobalSearch />
          <button
            type="button"
            onClick={() => toast.info('You have new AI insights')}
            aria-label="Notifications (new AI insights)"
            className={iconButtonClass}
          >
            <Bell size={18} aria-hidden="true" />
            <span
              aria-hidden="true"
              className="bg-danger ring-bg-2 absolute top-2.5 right-2.5 size-2 rounded-full ring-2"
            />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
