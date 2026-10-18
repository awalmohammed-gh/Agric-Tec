'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUiStore } from '@/store/ui-store';

/** Dark backdrop behind the mobile drawer. Closes it on click, on Escape and on route change. */
export function MobileNavOverlay() {
  const pathname = usePathname();
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  useEffect(() => {
    closeSidebar();
  }, [pathname, closeSidebar]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen, closeSidebar]);

  if (!sidebarOpen) return null;

  return (
    <div
      aria-hidden="true"
      onClick={closeSidebar}
      className="animate-fade-in fixed inset-0 z-30 bg-black/60 backdrop-blur-sm min-[900px]:hidden"
    />
  );
}
