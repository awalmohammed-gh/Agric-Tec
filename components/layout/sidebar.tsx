'use client';

import { BrandLogo } from '@/components/layout/brand-logo';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { UserMenu } from '@/components/layout/user-menu';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/ui-store';

export const SIDEBAR_ID = 'app-sidebar';

/** Floating sidebar: inset from the screen edges with rounded corners. */
export function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  return (
    <aside
      id={SIDEBAR_ID}
      aria-label="Sidebar"
      className={cn(
        'glass shadow-glass fixed inset-y-3 left-3 z-40 flex w-[260px] flex-col overflow-hidden rounded-3xl',
        'transition-[transform,visibility] duration-300 ease-out',
        // Always visible from 900px; below that, an off-canvas drawer.
        // `invisible` keeps the hidden drawer's links out of the Tab order.
        'min-[900px]:visible min-[900px]:translate-x-0',
        sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-[calc(100%+1rem)]',
      )}
    >
      <BrandLogo subtitle="Digital Identity" className="border-border border-b px-5 py-5" />

      <SidebarNav onNavigate={closeSidebar} />

      <div className="border-border border-t p-3">
        <UserMenu />
      </div>
    </aside>
  );
}
