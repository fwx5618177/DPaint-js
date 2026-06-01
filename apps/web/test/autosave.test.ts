import { describe, it, expect } from "vitest";
import { saveAutosave, loadAutosave, clearAutosave, type KeyValueStorage } from "../src/state/autosave";

class FakeStorage implements KeyValueStorage {
  map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe("autosave", () => {
  it("round-trips a saved payload", () => {
    const s = new FakeStorage();
    saveAutosave("hello", s);
    expect(loadAutosave(s)).toBe("hello");
  });
  it("returns null when nothing is saved", () => {
    expect(loadAutosave(new FakeStorage())).toBeNull();
  });
  it("clears the autosave", () => {
    const s = new FakeStorage();
    saveAutosave("x", s);
    clearAutosave(s);
    expect(loadAutosave(s)).toBeNull();
  });
  it("never throws when storage is unavailable", () => {
    expect(() => saveAutosave("x", null)).not.toThrow();
    expect(loadAutosave(null)).toBeNull();
  });
});
