export const SESSION_KEY = 'nelson-demo-session';

export interface SessionStore {
  read(): string | null;
  write(profileId: string): void;
  clear(): void;
}

export const browserSessionStore: SessionStore = {
  read: () => {
    try {
      return sessionStorage.getItem(SESSION_KEY);
    } catch {
      return null;
    }
  },
  write: (profileId) => {
    try {
      sessionStorage.setItem(SESSION_KEY, profileId);
    } catch {
      // A storage-restricted browser still gets an in-memory demo session.
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // A storage-restricted browser still gets an in-memory demo session.
    }
  },
};
