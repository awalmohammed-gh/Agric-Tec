// The ONLY module that touches localStorage / sessionStorage.
// Every read is SSR-safe and wrapped in try/catch, so corrupt data or a full quota never crashes the app.

const PREFIX = 'agrictec:';
const isBrowser = () => typeof window !== 'undefined';

function read<T>(area: Storage, key: string, fallback: T): T {
  try {
    const raw = area.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write<T>(area: Storage, key: string, value: T): void {
  try {
    area.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.warn(`[storage] Could not save "${key}" (storage may be full).`, error);
  }
}

export const storage = {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser()) return fallback;
    return read(window.localStorage, key, fallback);
  },

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return;
    write(window.localStorage, key, value);
  },

  remove(key: string): void {
    if (!isBrowser()) return;
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      // Storage unavailable (e.g. private mode): nothing to remove.
    }
  },

  /** Removes every key that belongs to one user: "agrictec:<userId>:*". */
  clearUser(userId: string): void {
    if (!isBrowser()) return;
    try {
      const userPrefix = PREFIX + userId + ':';
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key?.startsWith(userPrefix)) keys.push(key);
      }
      keys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      throw new Error(
        'Could not delete your data. Check your browser storage settings and try again.',
      );
    }
  },

  /** Replace one user's data, restoring the previous values if a write fails. */
  replaceUser(userId: string, data: Record<string, unknown>): void {
    if (!isBrowser()) throw new Error('Data import is only available in your browser.');
    const area = window.localStorage;
    const prefix = PREFIX + userId + ':';
    const previous = new Map<string, string>();
    const currentKeys = () => {
      const keys: string[] = [];
      for (let index = 0; index < area.length; index++) {
        const key = area.key(index);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      return keys;
    };
    currentKeys().forEach((key) => {
      const raw = area.getItem(key);
      if (raw !== null) previous.set(key, raw);
    });
    try {
      currentKeys().forEach((key) => area.removeItem(key));
      for (const [name, value] of Object.entries(data))
        area.setItem(prefix + name, JSON.stringify(value));
    } catch {
      try {
        currentKeys().forEach((key) => area.removeItem(key));
        previous.forEach((raw, key) => area.setItem(key, raw));
      } catch {
        throw new Error(
          'Storage is unavailable. Your backup file is unchanged; restore it when browser storage is available.',
        );
      }
      throw new Error('Import failed. Your previous data has been restored.');
    }
  },
};

/** Per-tab storage: values last until the browser tab is closed. */
export const sessionStore = {
  get<T>(key: string, fallback: T): T {
    if (!isBrowser()) return fallback;
    return read(window.sessionStorage, key, fallback);
  },

  set<T>(key: string, value: T): void {
    if (!isBrowser()) return;
    write(window.sessionStorage, key, value);
  },
};

/** e.g. userKey(id, 'records') → stored as "agrictec:<userId>:records", so every user's data is separate. */
export const userKey = (userId: string, name: string) => `${userId}:${name}`;

/** Simulated network latency, so loading states are visible and services behave like a real API. */
export const delay = (ms = 150) => new Promise<void>((resolve) => setTimeout(resolve, ms));
