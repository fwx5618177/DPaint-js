import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "runtime",
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
