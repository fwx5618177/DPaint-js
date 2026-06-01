import { defineWorkspace } from "vitest/config";

// Aggregate every workspace project's Vitest config. We target the config files
// directly (rather than `packages/*` / `apps/*`) so that members without a
// Vitest setup — e.g. the legacy app under apps/legacy, which only ships a
// Playwright suite — are not mistakenly picked up.
export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
