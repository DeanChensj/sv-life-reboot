// Safe localStorage wrapper for Safari Private Browsing, Restricted WebViews, Sandboxed Iframes, and Node.js test environments
const memoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      memoryStorage.set(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      memoryStorage.delete(key);
    } catch {
      memoryStorage.delete(key);
    }
  }
};
