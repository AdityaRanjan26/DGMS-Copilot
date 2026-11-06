/**
 * lib/preference-store.ts
 *
 * User preferences persisted to localStorage.
 * Includes: theme, language, font size, last page, notification prefs.
 */

export type Theme = "light" | "dark" | "system";
export type FontSize = "sm" | "md" | "lg";

export interface UserPreferences {
  theme: Theme;
  language: "hi" | "en";
  fontSize: FontSize;
  lastPage: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  autoScroll: boolean;
  streamingEnabled: boolean;
}

const STORAGE_KEY = "dgms-preferences";

const DEFAULTS: UserPreferences = {
  theme: "light",
  language: "hi",
  fontSize: "md",
  lastPage: "/dashboard",
  notificationsEnabled: true,
  soundEnabled: false,
  autoScroll: true,
  streamingEnabled: true,
};

export const PreferenceStore = {
  load(): UserPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  },

  save(prefs: Partial<UserPreferences>): UserPreferences {
    const current = PreferenceStore.load();
    const updated = { ...current, ...prefs };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Storage full
    }
    return updated;
  },

  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return PreferenceStore.load()[key];
  },

  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    PreferenceStore.save({ [key]: value });
  },

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  },
};
