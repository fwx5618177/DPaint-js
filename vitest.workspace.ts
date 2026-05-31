import { defineWorkspace } from "vitest/config";

// Each package/app defines its own vitest config; this aggregates them so that
// `pnpm test` (vitest run) executes the whole monorepo's suite at once.
export default defineWorkspace([
  "packages/*",
  "apps/*",
]);
