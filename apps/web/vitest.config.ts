import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern",
        silenceDeprecations: ["import", "legacy-js-api"],
      },
    },
  },
  test: {
    name: "web",
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
  },
});
