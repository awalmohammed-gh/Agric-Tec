'use client';

import { useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Menu, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { GlobalSearch } from '@/components/layout/global-search';
import { SIDEBAR_ID } from '@/components/layout/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { NAV_SECTIONS, PAGE_META } from '@/constants/navigation';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

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
    const item = section.items.find(
      (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
    );
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

// Scroll position as an external store, so the bar can turn more solid once the page scrolls.
const subscribeScroll = (onChange: () => void) => {
  window.addEventListener('scroll', onChange, { passive: true });
  return () => window.removeEventListener('scroll', onChange);
};
const getScrolled = () => window.scrollY > 8;
const getServerScrolled = () => false;

/** Floating, sticky top bar. The title block re-animates on every navigation. */
export function Topbar() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const openSidebar = useUiStore((s) => s.openSidebar);
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolled, getServerScrolled);
  const { title, subtitle, section, icon: Icon } = pageInfo(pathname);

  return (
    <header className="sticky top-3 z-30 mb-6">
      <div
        className={cn(
          'border-border flex items-center gap-2 rounded-2xl border px-2 py-2 backdrop-blur-xl transition-[background-color,box-shadow] duration-300 sm:gap-3 sm:px-3',
          scrolled
            ? 'bg-glass-strong shadow-glass'
            : 'bg-glass shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)]',
        )}
      >
        <button
          type="button"
          onClick={openSidebar}
          aria-label="Open menu"
          aria-controls={SIDEBAR_ID}
          aria-expanded={sidebarOpen}
          className={`${iconButtonClass} min-[900px]:hidden`}
        >
          <Menu size={20} aria-hidden="true" />
        </button>

        {/* key={pathname}: the whole block fades in again whenever the route changes */}
        <div key={pathname} className="animate-fade-in flex min-w-0 flex-1 items-center gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className="from-accent/25 to-accent/5 text-ink-green hidden size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br sm:inline-flex"
            >
              <Icon size={20} />
            </span>
          )}
          <div className="min-w-0">
            {section && (
              <p className="text-text-mute text-[11px] font-semibold tracking-wider uppercase">
                {section}
              </p>
            )}
            <h1 className="font-display text-text truncate text-lg leading-tight font-bold sm:text-xl">
              {title}
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
