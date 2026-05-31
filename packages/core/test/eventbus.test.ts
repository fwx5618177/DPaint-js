import { describe, it, expect, vi } from "vitest";
import { createEventBus } from "../src/eventbus.js";

describe("EventBus", () => {
  it("delivers triggered topics to handlers", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("topic", handler);
    bus.trigger("topic", 42);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(42);
  });

  it("supports multiple handlers per topic in registration order", () => {
    const bus = createEventBus();
    const calls: number[] = [];
    bus.on("t", () => calls.push(1));
    bus.on("t", () => calls.push(2));
    bus.trigger("t");
    expect(calls).toEqual([1, 2]);
  });

  it("unsubscribes via the returned handle", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const off = bus.on("t", handler);
    off();
    bus.trigger("t");
    expect(handler).not.toHaveBeenCalled();
  });

  it("unsubscribes via off()", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("t", handler);
    bus.off("t", handler);
    bus.trigger("t");
    expect(handler).not.toHaveBeenCalled();
  });

  it("off() is a no-op for unknown handlers", () => {
    const bus = createEventBus();
    expect(() => bus.off("t", () => {})).not.toThrow();
  });

  it("buffers while held and coalesces by topic (last wins)", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("t", handler);
    bus.hold();
    bus.trigger("t", "a");
    bus.trigger("t", "b");
    expect(handler).not.toHaveBeenCalled();
    bus.release();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("b");
  });

  it("replays distinct buffered topics on release", () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("a", a);
    bus.on("b", b);
    bus.hold();
    bus.trigger("a", 1);
    bus.trigger("b", 2);
    bus.release();
    expect(a).toHaveBeenCalledWith(1);
    expect(b).toHaveBeenCalledWith(2);
  });

  it("allows a handler to unsubscribe during dispatch without skipping others", () => {
    const bus = createEventBus();
    const calls: string[] = [];
    const first = () => {
      calls.push("first");
      bus.off("t", first);
    };
    bus.on("t", first);
    bus.on("t", () => calls.push("second"));
    bus.trigger("t");
    bus.trigger("t");
    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("reset() removes all handlers and clears hold state", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    bus.on("t", handler);
    bus.hold();
    bus.reset();
    bus.trigger("t");
    expect(handler).not.toHaveBeenCalled();
  });
});
