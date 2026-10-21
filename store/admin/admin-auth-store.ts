import { create } from 'zustand';
import type { AdminUser } from '@/types/admin';

// Phase A1 keeps only the signed-in admin, so permission hooks have a role to read.
// Phase A4 adds sign-in, sign-out, the forced password change and the session timeout.

interface AdminAuthState {
  admin: AdminUser | null;
}

export const useAdminAuthStore = create<AdminAuthState>()(() => ({
  admin: null,
}));
