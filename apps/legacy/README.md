# `apps/legacy/` — original plain-JS DPaint.js

This directory holds the **original, pre-migration DPaint.js application**,
written in plain ES6 JavaScript with zero runtime dependencies. It is kept
deliberately, for two reasons:

1. **Migration reference.** The TypeScript + React port under `packages/` and
   `apps/web` is still in progress. Many subsystems are not ported yet (the full
   IFF / PNG / PSD / GIF parsers, `imageProcessing` / quantizer, the `alchemy`
   effects, and several advanced UI panels). This code is the source of truth
   while those are migrated module by module.
2. **Working fallback.** Until the React app reaches feature parity, this is the
   only fully-featured build of the editor.

## This is not part of the active TypeScript toolchain
- It is excluded from the root `pnpm typecheck` / `pnpm test` / `pnpm build`.
- It has its own, separate dependencies (`vite`, `@playwright/test`,
  `http-server`) and its own Playwright end-to-end suite under `tests/`.

## Running it
From the repository root:

| Command | Description |
| --- | --- |
| `pnpm legacy:start` | Serve the app at http://localhost:8080 |
| `pnpm legacy:build` | Build to `legacy/dist` |
| `pnpm legacy:test`  | Run the Playwright end-to-end suite |

## Lifecycle / when this goes away
`legacy/` is **temporary**. Once the React app reaches feature parity and the
remaining modules listed above have been ported (with tests), this whole
directory should be deleted — its history remains available in git. Track the
migration status in the root `README.md`.
