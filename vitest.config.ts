import { defineConfig } from "vitest/config";

// Root config: per-project test setup lives in each package's vitest.config.ts
// (aggregated through vitest.workspace.ts). This root file only carries global
// coverage options so reports are scoped to the migrated TypeScript sources
// rather than the legacy plain-JS tree under _script/.
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html"],
      include: ["packages/*/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}"],
      exclude: ["**/*.d.ts", "**/index.ts", "apps/web/src/main.tsx"],
    },
  },
});
