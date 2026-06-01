import { describe, it, expect } from "vitest";
import { COMMAND, EVENT, ANIMATION } from "../src/enums.js";

describe("enums", () => {
  it("preserves legacy COMMAND values", () => {
    expect(COMMAND.NEW).toBe(1001);
    expect(COMMAND.OPEN).toBe(1002);
    expect(COMMAND.TOGGLERULERS).toBe(1124);
  });

  it("has unique COMMAND values", () => {
    const values = Object.values(COMMAND);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has unique EVENT values", () => {
    const values = Object.values(EVENT);
    expect(new Set(values).size).toBe(values.length);
  });

  it("preserves legacy EVENT values", () => {
    expect(EVENT.drawColorChanged).toBe(1);
    expect(EVENT.rulerOptionsChanged).toBe(42);
  });

  it("exposes animation kinds", () => {
    expect(ANIMATION).toMatchObject({ CYCLE: 1, SPRAY: 2, TEXT: 3 });
  });
});
