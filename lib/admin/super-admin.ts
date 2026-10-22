// The owner's super admin sign-in, set in .env (admin_email / admin_password). next.config.ts
// turns them into an email and a SHA-256 hash at build time; the password itself never reaches
// the browser. Without them, the demo super admin (lib/admin/seed.ts) is used.

const email = (process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase();
const passwordHash = (process.env.NEXT_PUBLIC_SUPER_ADMIN_PASSWORD_HASH ?? '').trim();

export interface ConfiguredSuperAdmin {
  email: string;
  passwordHash: string;
  /**
   * Identifies this .env setting. Stored on the account when applied, so it is applied once:
   * a password changed later inside the console stays, until the .env values change.
   */
  fingerprint: string;
}

/** The .env super admin, or null when the build had none. */
export const CONFIGURED_SUPER_ADMIN: ConfiguredSuperAdmin | null =
  email && /^[0-9a-f]{64}$/.test(passwordHash)
    ? { email, passwordHash, fingerprint: `${email}|${passwordHash}` }
    : null;
