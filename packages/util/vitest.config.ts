import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "util",
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
