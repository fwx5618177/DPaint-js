import { describe, it, expect } from "vitest";
import { History } from "../src/History";

describe("History", () => {
  it("starts empty", () => {
    const h = new History<number>();
    expect(h.size).toBe(0);
    expect(h.current).toBeNull();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("reset seeds a single state", () => {
    const h = new History<number>();
    h.reset(1);
    expect(h.size).toBe(1);
    expect(h.current).toBe(1);
    expect(h.canUndo).toBe(false);
  });

  it("push enables undo and tracks the current state", () => {
    const h = new History<number>();
    h.reset(1);
    h.push(2);
    expect(h.current).toBe(2);
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);
  });

  it("undo and redo move through the stack", () => {
    const h = new History<number>();
    h.reset(1);
    h.push(2);
    h.push(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.undo()).toBeNull();
    expect(h.redo()).toBe(2);
    expect(h.redo()).toBe(3);
    expect(h.redo()).toBeNull();
  });

  it("pushing after an undo truncates the redo branch", () => {
    const h = new History<number>();
    h.reset(1);
    h.push(2);
    h.push(3);
    h.undo(); // back to 2
    h.push(99); // new branch
    expect(h.current).toBe(99);
    expect(h.canRedo).toBe(false);
    expect(h.undo()).toBe(2);
  });

  it("respects the configured size limit", () => {
    const h = new History<number>(3);
    h.reset(0);
    h.push(1);
    h.push(2);
    h.push(3); // exceeds limit -> oldest (0) dropped
    expect(h.size).toBe(3);
    expect(h.current).toBe(3);
    expect(h.undo()).toBe(2);
    expect(h.undo()).toBe(1);
    expect(h.canUndo).toBe(false); // 0 was evicted
  });
});
