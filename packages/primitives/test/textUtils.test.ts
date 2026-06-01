import { describe, it, expect } from "vitest";
import { DuplicateName } from "../src/textUtils.js";

const layers = (...names: string[]) => names.map((name) => ({ name }));

describe("DuplicateName", () => {
  it("appends ' duplicate' to a fresh name", () => {
    expect(DuplicateName("Layer", layers("Layer"))).toBe("Layer duplicate");
  });

  it("numbers further duplicates", () => {
    expect(DuplicateName("Layer", layers("Layer", "Layer duplicate"))).toBe("Layer duplicate 2");
    expect(
      DuplicateName("Layer", layers("Layer", "Layer duplicate", "Layer duplicate 2")),
    ).toBe("Layer duplicate 3");
  });

  it("strips an existing ' duplicate' suffix before re-duplicating", () => {
    expect(DuplicateName("Layer duplicate", layers("Layer duplicate"))).toBe(
      "Layer duplicate 2",
    );
  });

  it("returns the base duplicate name when no collisions exist", () => {
    expect(DuplicateName("Sky", layers("Ground"))).toBe("Sky duplicate");
  });
});
