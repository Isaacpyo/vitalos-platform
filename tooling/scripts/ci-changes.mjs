// Decides which CI jobs a pull request needs (AGENTS.md, CI cost). Run by the `quality` job in
// .github/workflows/ci.yml after `pnpm install`; writes its decisions to $GITHUB_OUTPUT.
//
//   node tooling/scripts/ci-changes.mjs            pull request: diff HEAD^1..HEAD (the PR merge commit)
//   node tooling/scripts/ci-changes.mjs --full     push to main or manual run: everything runs
//
// Turborepo's --affected only sees files inside workspace packages. The root browser suites (tests/,
// playwright.config.ts) run the browser jobs; any other file outside a package (tooling/, root
// config, the lockfile, ci.yml) forces a full run. Markdown, docs/, superadmin/ and the other
// workflows start nothing beyond `quality` itself (the same files skip pushes to main).
import { execFileSync, execSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_DIRS = ["apps/", "packages/", "services/", "workers/"];
// Editorial content (ADR-028). TypeScript, so `quality` still lints and typechecks it; builds, unit
// tests and browser suites are skipped when a change touches nothing else.
const CONTENT_DIR = "packages/cms/src/repo/";
// Read only by the Playwright and integration suites, never by a workspace package.
const BROWSER_SUITES = ["tests/", "playwright.config.ts"];
const OTHER_WORKFLOWS = [
  "audit",
  "backup",
  "codeql",
  "secret-scan",
  "superadmin",
  "superadmin-deploy",
];

/** True for files that cannot change the outcome of any ci.yml job. */
export function isIgnored(file) {
  if (file.startsWith("docs/strategy/")) return false; // read by packages/cms/src/draft/draft.test.ts
  if (file.endsWith(".md") || file.startsWith("docs/") || file.startsWith("superadmin/"))
    return true;
  if (OTHER_WORKFLOWS.some((name) => file === `.github/workflows/${name}.yml`)) return true;
  return [".github/dependabot.yml", ".github/CODEOWNERS", ".env.example"].includes(file);
}

/**
 * Classifies changed files. `affected` is the list of workspace package names Turborepo reports
 * as affected (packages that changed and their dependents).
 */
export function classify(files, affected = []) {
  const relevant = files.filter((file) => !isIgnored(file));
  const content = relevant.filter((file) => file.startsWith(CONTENT_DIR));
  const code = relevant.filter(
    (file) => !file.startsWith(CONTENT_DIR) && PACKAGE_DIRS.some((dir) => file.startsWith(dir)),
  );
  const database = relevant.some((file) => file.startsWith("supabase/"));
  const browser = relevant.some((file) => BROWSER_SUITES.some((path) => file.startsWith(path)));
  const full = relevant.some(
    (file) =>
      !file.startsWith("supabase/") &&
      !BROWSER_SUITES.some((path) => file.startsWith(path)) &&
      !PACKAGE_DIRS.some((dir) => file.startsWith(dir)),
  );
  if (full) return everything();
  const builds = code.length > 0;
  return {
    full: false,
    static: builds || content.length > 0,
    unit: builds,
    web: browser || (builds && affected.includes("@vitalos/web")),
    storybook: browser || (builds && affected.includes("@vitalos/storybook")),
    database,
  };
}

export function everything() {
  return { full: true, static: true, unit: true, web: true, storybook: true, database: true };
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function main() {
  let decision;
  if (process.argv.includes("--full")) {
    decision = everything();
  } else {
    const files = git("diff", "--name-only", "HEAD^1", "HEAD").split("\n").filter(Boolean);
    // A shell, so the corepack shim also resolves on Windows (as in tests/support/run-sparse.mjs).
    const ls = execSync("corepack pnpm exec turbo ls --affected --output=json", {
      encoding: "utf8",
      env: { ...process.env, TURBO_SCM_BASE: "HEAD^1", TURBO_SCM_HEAD: "HEAD" },
    });
    const affected = JSON.parse(ls.slice(ls.indexOf("{"))).packages.items.map((item) => item.name);
    decision = classify(files, affected);
    console.log(`Changed files (${files.length}):\n  ${files.join("\n  ")}`);
    console.log(`Affected packages: ${affected.join(", ") || "none"}`);
  }
  console.log("Decision:", JSON.stringify(decision));
  if (process.env.GITHUB_OUTPUT) {
    const lines = Object.entries(decision).map(([key, value]) => `${key}=${value}`);
    appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
