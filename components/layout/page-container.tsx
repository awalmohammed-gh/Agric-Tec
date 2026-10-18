'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** Re-mounts on every route change so each page fades in. */
export function PageContainer({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-in">
      {children}
    </div>
  );
}
