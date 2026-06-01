import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "imaging",
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
  },
});
