import type { Metadata } from 'next';
import { AdminWelcome } from '@/components/admin/auth/admin-welcome';

export const metadata: Metadata = { title: 'Overview' };

/** Placeholder until phase A5 (shell) and A6 (overview dashboard). */
export default function AdminHomePage() {
  return <AdminWelcome />;
}
