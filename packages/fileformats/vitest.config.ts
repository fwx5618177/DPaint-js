import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "fileformats",
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
