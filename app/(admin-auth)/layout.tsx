import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { Lock } from 'lucide-react';
import { AdminBackground } from '@/components/admin/layout/admin-background';
import { AdminBrand } from '@/components/admin/layout/admin-brand';
import { Card } from '@/components/ui/card';

export const metadata: Metadata = {
  title: { default: 'Admin Console', template: '%s | AgriCtec Admin' },
  robots: { index: false, follow: false },
};

/** The admin sign-in door: separate from the farmer login, with its own look. */
export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdminBackground />
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="animate-fade-in w-full max-w-[440px]">
          <div className="mb-6 flex flex-col items-center text-center">
            <AdminBrand />
          </div>
          <Card padding="lg">{children}</Card>
          <p className="text-text-mute mt-6 flex items-center justify-center gap-1.5 text-xs">
            <Lock size={12} aria-hidden="true" />
            Authorized staff only. All actions are logged.
          </p>
        </div>
      </main>
    </>
  );
}
