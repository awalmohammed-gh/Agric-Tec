import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AdminSessionGate } from '@/components/admin/auth/admin-session-gate';
import { AdminBackground } from '@/components/admin/layout/admin-background';

export const metadata: Metadata = {
  title: { default: 'Admin Console', template: '%s | AgriCtec Admin' },
  robots: { index: false, follow: false },
};

/** The signed-in console. Phase A5 adds the sidebar, top bar and data loader inside the gate. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminBackground />
      <AdminSessionGate>{children}</AdminSessionGate>
    </>
  );
}
