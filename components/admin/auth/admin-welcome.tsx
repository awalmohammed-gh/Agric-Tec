'use client';

import { AdminSignOutButton } from '@/components/admin/auth/admin-sign-out-button';
import { AdminBrand } from '@/components/admin/layout/admin-brand';
import { Card } from '@/components/ui/card';
import { ROLE_LABELS } from '@/lib/admin/permissions';
import { useAdminAuthStore } from '@/store/admin/admin-auth-store';

/** Temporary landing card for /admin until phase A5 builds the console shell and overview. */
export function AdminWelcome() {
  const admin = useAdminAuthStore((s) => s.admin);
  if (!admin) return null;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card padding="lg" className="w-full max-w-md text-center">
        <AdminBrand className="mb-5 justify-center" />
        <h1 className="font-display text-text text-xl font-bold">Welcome, {admin.name}</h1>
        <p className="text-text-dim mt-1 text-sm">
          Signed in as {admin.email} · {ROLE_LABELS[admin.role]}
        </p>
        <p className="text-text-mute mt-4 text-sm">The console shell arrives in phase A5.</p>
        <AdminSignOutButton className="mt-6" />
      </Card>
    </main>
  );
}
