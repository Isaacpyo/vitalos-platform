// Runs the `sparse` Playwright project: builds and serves apps/web with VITALOS_FIXTURE_SET=sparse
// (playwright.config.ts defines only the sparse project when E2E_FIXTURE_SET=sparse). A separate
// script, not an inline env assignment, so it behaves the same in PowerShell, cmd and POSIX shells.
// Extra arguments are passed through to Playwright (for example `--reporter=list`).
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "corepack",
  ["pnpm", "exec", "playwright", "test", "tests/end-to-end", ...process.argv.slice(2)],
  { stdio: "inherit", shell: true, env: { ...process.env, E2E_FIXTURE_SET: "sparse" } },
);
process.exit(result.status ?? 1);
