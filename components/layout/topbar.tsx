'use client';

import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { GlobalSearch } from '@/components/layout/global-search';
import { SIDEBAR_ID } from '@/components/layout/sidebar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { PAGE_META } from '@/constants/navigation';
import { useUiStore } from '@/store/ui-store';

const iconButtonClass =
  'glass relative inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-text-dim transition-colors hover:bg-glass-strong hover:text-text';

function metaFor(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname];
  const match = Object.keys(PAGE_META).find((href) => pathname.startsWith(href));
  return match ? PAGE_META[match] : { title: 'AgriCtec', subtitle: '' };
}

export function Topbar() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const openSidebar = useUiStore((s) => s.openSidebar);
  const { title, subtitle } = metaFor(pathname);

  return (
    <header className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-3">
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

      <div className="min-w-0 flex-1">
        <h1 className="font-display text-text text-2xl leading-tight font-bold md:text-[32px]">
          {title}
        </h1>
        {subtitle && <p className="text-text-dim mt-1 text-sm">{subtitle}</p>}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
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
            className="bg-danger ring-bg-1 absolute top-2.5 right-2.5 size-2 rounded-full ring-2"
          />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
