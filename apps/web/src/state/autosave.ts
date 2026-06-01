/**
 * Local-storage autosave for the current project (ports the legacy autosave /
 * restoreAutoSave behaviour). The persistence is a thin, injectable wrapper so
 * the logic is testable without a real browser.
 */

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const AUTOSAVE_KEY = "dp_autosave";

function resolveStorage(): KeyValueStorage | null {
  if (typeof globalThis !== "undefined") {
    const ls = (globalThis as { localStorage?: KeyValueStorage }).localStorage;
    if (ls) return ls;
  }
  return null;
}

/** Persist a serialized project string. */
export function saveAutosave(json: string, storage: KeyValueStorage | null = resolveStorage()): void {
  try {
    storage?.setItem(AUTOSAVE_KEY, json);
  } catch {
    /* storage full / unavailable — ignore */
  }
}

/** Read the autosaved project string, or null if none. */
export function loadAutosave(storage: KeyValueStorage | null = resolveStorage()): string | null {
  try {
    return storage?.getItem(AUTOSAVE_KEY) ?? null;
  } catch {
    return null;
  }
}

/** Clear the autosave. */
export function clearAutosave(storage: KeyValueStorage | null = resolveStorage()): void {
  try {
    storage?.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

export { AUTOSAVE_KEY };
