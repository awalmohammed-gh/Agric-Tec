// DEMO ONLY — this is NOT real security. Users and password hashes live in the browser's
// localStorage, where anyone with access to the device can read or change them.
// Replace this module with calls to a real authentication API before going to production.

import { generateId } from '@/lib/utils';
import { delay, storage } from '@/services/storage';
import type { Session } from '@/types';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  isGuest: boolean;
  createdAt: string;
}

const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const GUEST_ID_KEY = 'guestId';
const GUEST_EMAIL = 'guest@agrictec.demo';
const SESSION_COOKIE = 'agrictec_session';

const normalizeEmail = (email: string) => email.trim().toLowerCase();

async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const readUsers = () => storage.get<StoredUser[]>(USERS_KEY, []);
const writeUsers = (users: StoredUser[]) => storage.set(USERS_KEY, users);

/** The cookie is only a flag for proxy.ts; the session itself lives in localStorage. */
function setSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=2592000; SameSite=Lax`;
}

function clearSessionCookie(): void {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

function startSession(user: StoredUser): Session {
  const session: Session = {
    userId: user.id,
    email: user.email,
    isGuest: user.isGuest,
    startedAt: new Date().toISOString(),
  };
  storage.set(SESSION_KEY, session);
  setSessionCookie();
  return session;
}

export const authService = {
  async signUp(email: string, password: string): Promise<Session> {
    await delay();
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
    const session = storage.get<Session | null>(SESSION_KEY, null);
    // Keep the proxy cookie in sync with the stored session (e.g. after the cookie expired).
    if (session) setSessionCookie();
    else clearSessionCookie();
    return session;
  },

  async signOut(): Promise<void> {
    await delay();
    storage.remove(SESSION_KEY);
    clearSessionCookie();
  },
};
