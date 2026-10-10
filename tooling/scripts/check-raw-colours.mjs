#!/usr/bin/env node
/**
 * Fails when a raw colour literal appears outside packages/design-tokens (Stage 9 section 33:
 * "No hard-coded random colours in page components"). Flags hex colours, rgb()/hsl()/oklch()
 * style functions and Tailwind arbitrary colour values such as bg-[#2457FF].
 *
 * Usage: node tooling/scripts/check-raw-colours.mjs [--root <dir>]
 * Escape hatch for a genuine non-colour match: add `raw-colour-ok` in a comment on the same line.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const argRoot = process.argv.indexOf("--root");
const repoRoot =
  argRoot !== -1 && process.argv[argRoot + 1]
    ? resolve(process.argv[argRoot + 1])
    : resolve(scriptDir, "..", "..");

const SCAN_DIRS = ["apps", "packages", "services", "workers", "tests"];
const EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".mdx",
  ".html",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  "coverage",
  "storybook-static",
  "playwright-report",
  "test-results",
  ".git",
  "generated",
]);
/** Directories (relative to the repo root, posix) where raw colours are the point. */
const ALLOWED_PREFIXES = ["packages/design-tokens/"];

const HEX =
  /(?<![\w&#/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/;
const COLOUR_FUNCTION = /\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(\s*[-\d.%]/i;
const TAILWIND_ARBITRARY = /-\[(?:#|rgb|hsl|oklch|oklab)/i;
const ESCAPE = /raw-colour-ok/;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    const stats = statSync(full);
    if (stats.isDirectory()) yield* walk(full);
    else {
      const dot = name.lastIndexOf(".");
      if (dot !== -1 && EXTENSIONS.has(name.slice(dot))) yield full;
    }
  }
}

const violations = [];
let scanned = 0;
for (const top of SCAN_DIRS) {
  for (const file of walk(join(repoRoot, top))) {
    const rel = relative(repoRoot, file).split(sep).join("/");
    if (ALLOWED_PREFIXES.some((prefix) => rel.startsWith(prefix))) continue;
    scanned += 1;
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      if (ESCAPE.test(line)) return;
      const match = HEX.exec(line) ?? COLOUR_FUNCTION.exec(line) ?? TAILWIND_ARBITRARY.exec(line);
      if (match) violations.push(`${rel}:${index + 1}  ${match[0]}`);
    });
  }
}

if (violations.length > 0) {
  console.error(
    `Raw colours found outside packages/design-tokens (${violations.length}). Use a design token.\n`,
  );
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log(
  `check-raw-colours: ok (${scanned} files scanned, no raw colours outside design-tokens).`,
);
