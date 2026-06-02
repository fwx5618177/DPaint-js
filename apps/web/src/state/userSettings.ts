/**
 * User preferences persisted to localStorage, ported from the legacy
 * UserSettings module (key "dp_settings").
 */
export interface UserSettings {
  touchRotate: boolean;
  useMultiPalettes: boolean;
  penOnlyAllowColorPicker: boolean;
  sidepanel: boolean;
  sidepanelWidth: number;
  lastSaveFormat: string;
}

const STORAGE_KEY = "dp_settings";

export function defaultSettings(): UserSettings {
  return {
    touchRotate: true,
    useMultiPalettes: false,
    penOnlyAllowColorPicker: true,
    sidepanel: false,
    sidepanelWidth: 175,
    lastSaveFormat: "DPAINTJS",
  };
}

export function loadSettings(): UserSettings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return defaultSettings();
    return { ...defaultSettings(), ...(JSON.parse(raw) as Partial<UserSettings>) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }
  } catch {
    // ignore quota / privacy-mode failures
  }
}
