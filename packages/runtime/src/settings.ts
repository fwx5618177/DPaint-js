/**
 * Persisted user settings. The original implementation reached straight for
 * `localStorage`; here the storage backend is injectable so the store is fully
 * testable in a Node environment and SSR-safe.
 */

/** Default runtime settings (also exported as the legacy `SETTING` object). */
export interface UserSettingsShape {
  touchRotate: boolean;
  recordingMode: "stroke" | "frame" | string;
  useMultiPalettes: boolean;
  penOnlyAllowColorPicker: boolean;
  sidepanelWidth: number;
  lastSaveFormat: string;
  [key: string]: unknown;
}

export function getDefaultSettings(): UserSettingsShape {
  return {
    touchRotate: true,
    recordingMode: "stroke",
    useMultiPalettes: false,
    penOnlyAllowColorPicker: true,
    sidepanelWidth: 175,
    lastSaveFormat: "DPAINTJS",
  };
}

/** Mutable, app-wide runtime settings (mirrors the legacy `SETTING` export). */
export const SETTING: UserSettingsShape = getDefaultSettings();

/** Minimal subset of the Web Storage API used by the settings store. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function resolveStorage(): KeyValueStorage {
  if (typeof globalThis !== "undefined") {
    const candidate = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
    if (candidate) return candidate;
  }
  return new MemoryStorage();
}

const STORAGE_KEY = "dp_settings";

export interface UserSettings {
  get<K extends keyof UserSettingsShape>(key: K): UserSettingsShape[K];
  get(key: string): unknown;
  set(key: string, value: unknown, updateSETTING?: boolean): void;
  all(): UserSettingsShape;
}

export function createUserSettings(storage: KeyValueStorage = resolveStorage()): UserSettings {
  let settings = getDefaultSettings();

  const stored = storage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      settings = Object.assign(getDefaultSettings(), JSON.parse(stored));
    } catch (e) {
      console.error("Could not parse settings", e);
      settings = getDefaultSettings();
    }
  }

  // Hydrate the shared SETTING object from persisted values.
  for (const key of Object.keys(SETTING)) {
    if (settings[key] !== undefined) SETTING[key] = settings[key];
  }

  return {
    get(key: string) {
      return settings[key];
    },
    set(key: string, value: unknown, updateSETTING?: boolean) {
      settings[key] = value;
      storage.setItem(STORAGE_KEY, JSON.stringify(settings));
      if (updateSETTING) SETTING[key] = value;
    },
    all() {
      return { ...settings };
    },
  };
}

export default createUserSettings;
