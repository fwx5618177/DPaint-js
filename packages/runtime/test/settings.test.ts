import { describe, it, expect, beforeEach } from "vitest";
import { createUserSettings, getDefaultSettings, type KeyValueStorage } from "../src/settings.js";

class FakeStorage implements KeyValueStorage {
  store = new Map<string, string>();
  getItem(key: string) {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, value);
  }
}

describe("UserSettings", () => {
  let storage: FakeStorage;
  beforeEach(() => {
    storage = new FakeStorage();
  });

  it("returns defaults when nothing is stored", () => {
    const settings = createUserSettings(storage);
    expect(settings.get("sidepanelWidth")).toBe(175);
    expect(settings.get("lastSaveFormat")).toBe("DPAINTJS");
    expect(settings.all()).toEqual(getDefaultSettings());
  });

  it("persists values to storage", () => {
    const settings = createUserSettings(storage);
    settings.set("sidepanelWidth", 200);
    expect(settings.get("sidepanelWidth")).toBe(200);
    expect(JSON.parse(storage.getItem("dp_settings")!).sidepanelWidth).toBe(200);
  });

  it("hydrates from previously stored values merged over defaults", () => {
    storage.setItem("dp_settings", JSON.stringify({ sidepanelWidth: 300 }));
    const settings = createUserSettings(storage);
    expect(settings.get("sidepanelWidth")).toBe(300);
    // unspecified keys fall back to defaults
    expect(settings.get("lastSaveFormat")).toBe("DPAINTJS");
  });

  it("falls back to defaults on corrupt JSON", () => {
    storage.setItem("dp_settings", "{not json");
    const settings = createUserSettings(storage);
    expect(settings.all()).toEqual(getDefaultSettings());
  });

  it("all() returns a copy that does not mutate internal state", () => {
    const settings = createUserSettings(storage);
    const snapshot = settings.all();
    snapshot.sidepanelWidth = 999;
    expect(settings.get("sidepanelWidth")).toBe(175);
  });
});
