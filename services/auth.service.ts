// DEMO ONLY — this is NOT real security. Users and password hashes live in the browser's
// localStorage, where anyone with access to the device can read or change them.
// Replace this module with calls to a real authentication API before going to production.

import { generateId } from '@/lib/utils';
import { readFlags } from '@/services/admin/config.service';
import { delay, storage } from '@/services/storage';
import type { AccountStatus, Session } from '@/types';

/** A farmer account in "agrictec:users". Exported for the admin services, which manage these. */
export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  isGuest: boolean;
  createdAt: string;
  /** Set by the admin console. Missing means 'active' (accounts created before roles existed). */
  status?: AccountStatus;
  suspendedReason?: string;
  lastActiveAt?: string;
}

export const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const GUEST_ID_KEY = 'guestId';
const GUEST_EMAIL = 'guest@agrictec.demo';
const SESSION_COOKIE = 'agrictec_session';

export const SUSPENDED_MESSAGE = 'Your account is suspended. Contact support.';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const readUsers = () => storage.get<StoredUser[]>(USERS_KEY, []);
const writeUsers = (users: StoredUser[]) => storage.set(USERS_KEY, users);

/** Records when the farmer last used the app (shown to admins as "last active"). */
function markActive(userId: string): void {
  const now = new Date().toISOString();
  writeUsers(readUsers().map((u) => (u.id === userId ? { ...u, lastActiveAt: now } : u)));
}

/** The cookie is only a flag for proxy.ts; the session itself lives in localStorage. */
function setSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=2592000; SameSite=Lax`;
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  // The onboarding hint belongs to the session (services/onboarding.service.ts sets it).
  document.cookie = `agrictec_onboarded=; path=/; max-age=0; SameSite=Lax`;
}

function startSession(user: StoredUser): Session {
  if (user.status === 'suspended') throw new Error(SUSPENDED_MESSAGE);
  markActive(user.id);
  const session: Session = {
    userId: user.id,
    email: user.email,
    isGuest: user.isGuest,
    role: 'farmer',
    startedAt: new Date().toISOString(),
  };
  storage.set(SESSION_KEY, session);
  setSessionCookie();
  // A new session starts without the onboarding hint (a previous user's must not carry over);
  // the sign-in page sets it again once it has checked this farmer's profile.
  document.cookie = `agrictec_onboarded=; path=/; max-age=0; SameSite=Lax`;
  return session;
}

export const authService = {
  /** Blocked while the admin has closed sign-ups. */
  async signUp(email: string, password: string): Promise<Session> {
    await delay();
    if (!readFlags().signupOpen) throw new Error('New sign-ups are closed right now.');
    const normalized = normalizeEmail(email);
    const users = readUsers();
    if (users.some((u) => !u.isGuest && u.email === normalized)) {
      throw new Error('An account with this email already exists');
    }
    const user: StoredUser = {
      id: generateId(),
      email: normalized,
      passwordHash: await hashPassword(password),
      isGuest: false,
      createdAt: new Date().toISOString(),
    };
    writeUsers([...users, user]);
    return startSession(user);
  },

  async signIn(email: string, password: string): Promise<Session> {
    await delay();
    const normalized = normalizeEmail(email);
    const user = readUsers().find((u) => !u.isGuest && u.email === normalized);
    if (!user || user.passwordHash !== (await hashPassword(password))) {
      throw new Error('Incorrect email or password');
    }
    return startSession(user);
  },

  /** There is only ever one guest: its ID is created once and reused, so demo data never vanishes. */
  async continueAsGuest(): Promise<Session> {
    await delay();
    if (!readFlags().guestMode) throw new Error('Guest mode is turned off right now.');
    const users = readUsers();
    const guestId = storage.get<string | null>(GUEST_ID_KEY, null);

    let guest = guestId ? users.find((u) => u.id === guestId) : undefined;
    if (!guest) {
      guest = {
        id: guestId ?? generateId(),
        email: GUEST_EMAIL,
        passwordHash: '',
        isGuest: true,
        createdAt: new Date().toISOString(),
      };
      writeUsers([...users, guest]);
      storage.set(GUEST_ID_KEY, guest.id);
    }
    return startSession(guest);
  },

  async getSession(): Promise<Session | null> {
    await delay();
    const stored = storage.get<(Omit<Session, 'role'> & { role?: Session['role'] }) | null>(
      SESSION_KEY,
      null,
    );
    // Keep the proxy cookie in sync with the stored session (e.g. after the cookie expired).
    if (stored) setSessionCookie();
    else clearSessionCookie();
    // Sessions saved before roles existed have no role. Farmer-app sessions are always 'farmer',
    // whatever is stored: admins sign in separately (A4), so this store never grants admin access.
    return stored ? { ...stored, role: 'farmer' } : null;
  },

  /**
   * The account's current status, checked each time the app loads, so a farmer suspended by an
   * admin is signed out of an already-open session. Also records the visit as activity.
   */
  async checkAccount(userId: string): Promise<AccountStatus | 'deleted'> {
    const status = await this.accountStatus(userId);
    if (status !== 'deleted' && status !== 'suspended') markActive(userId);
    return status;
  },

  /**
   * The account's status, without recording a visit. For checks that react to another tab's
   * writes: recording one would write again and make the tabs answer each other forever.
   */
  async accountStatus(userId: string): Promise<AccountStatus | 'deleted'> {
    await delay(0);
    const user = readUsers().find((u) => u.id === userId);
    // An admin can delete an account permanently; its open session must end too.
    if (!user) return 'deleted';
    return user.status ?? 'active';
  },

  async signOut(): Promise<void> {
    await delay();
    storage.remove(SESSION_KEY);
    clearSessionCookie();
  },
};
