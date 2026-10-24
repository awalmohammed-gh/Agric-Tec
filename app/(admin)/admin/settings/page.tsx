import type { Metadata } from 'next';
import { RequirePermission } from '@/components/admin/layout/require-permission';
import { SystemSettings } from '@/components/admin/settings/system-settings';

export const metadata: Metadata = { title: 'System Settings' };

/** Guarded by settings.manage (Super Admin only; every change is checked again in the service). */
export default function SettingsPage() {
  return (
    <RequirePermission permission="settings.manage">
      <SystemSettings />
    </RequirePermission>
  );
}
