// Safe localStorage wrapper for Safari Private Browsing, Restricted WebViews, and Sandboxed Iframes

export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage === 'undefined') return null;
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, value);
    } catch {
      // Ignore storage write errors (quota exceeded or security error)
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }
};
