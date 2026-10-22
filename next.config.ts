import { createHash } from 'node:crypto';
import type { NextConfig } from 'next';

/**
 * The owner's super admin sign-in, from .env (admin_email / admin_password; ADMIN_EMAIL /
 * ADMIN_PASSWORD also work). This file runs at build time only. The browser never receives the
 * password: only the email and its SHA-256 hash (the format the console stores) are passed on.
 * Without these variables the demo super admin is used, as before.
 */
function superAdminEnv(): Record<string, string> {
  const email = (process.env.admin_email ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const password = process.env.admin_password ?? process.env.ADMIN_PASSWORD ?? '';
  if (!email && !password) return {};
  if (!email || !password) {
    throw new Error('.env: set both admin_email and admin_password (or neither).');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('.env: admin_email is not a valid email address.');
  }
  // The console's own password rules (lib/admin/passwords.ts): 10+ characters with an upper-
  // and lower-case letter, a number and a symbol.
  const weak =
    password.length < 10 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password);
  if (weak) {
    throw new Error(
      '.env: admin_password needs 10+ characters with upper- and lower-case letters, a number and a symbol.',
    );
  }
  return {
    NEXT_PUBLIC_SUPER_ADMIN_EMAIL: email,
    NEXT_PUBLIC_SUPER_ADMIN_PASSWORD_HASH: createHash('sha256').update(password).digest('hex'),
  };
}

const nextConfig: NextConfig = {
  reactCompiler: true, // stable in Next.js 16: automatic memoization
  // Hide the dev-only Next.js badge; on phones it sat over the bottom navigation.
  devIndicators: false,
  env: superAdminEnv(),
  // No webpack config: Turbopack is the default bundler.
  // Tailwind v4 is compiled by its Turbopack loader (this project has no PostCSS config).
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
