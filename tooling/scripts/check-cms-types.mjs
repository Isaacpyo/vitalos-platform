#!/usr/bin/env node
// Fails when the generated CMS types have drifted from the Sanity schema or the GROQ queries.
//
//   node tooling/scripts/check-cms-types.mjs           check (CI)
//   node tooling/scripts/check-cms-types.mjs --write   regenerate the committed files
//
// Pipeline: `sanity schema extract` (apps/studio, no credentials needed with
// SANITY_SCHEMA_EXTRACT=1) -> packages/cms/src/generated/schema.json, then
// `sanity typegen generate` (packages/cms/sanity.cli.ts) -> sanity.types.ts, which also parses
// every query in packages/cms/src/queries against the schema.
//
// In check mode the fresh schema is extracted to a temporary file, typegen runs against it, and
// the committed files are restored afterwards whatever happens. Nothing else is touched.
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const generated = join(root, "packages/cms/src/generated");
const schemaFile = join(generated, "schema.json");
const typesFile = join(generated, "sanity.types.ts");
const write = process.argv.includes("--write");

function pnpm(args, options = {}) {
  // When run through `pnpm <script>`, npm_execpath is the running pnpm: a JS entry (run it with
  // node) or, for the native build, an executable (run it directly).
  const execPath = process.env.npm_execpath;
  const viaPnpm = execPath && /pnpm/i.test(basename(execPath));
  const isScript = viaPnpm && /\.(c|m)?js$/i.test(execPath);
  const [command, argv, shell] = !viaPnpm
    ? ["corepack", ["pnpm", ...args], true]
    : isScript
      ? [process.execPath, [execPath, ...args], false]
      : [execPath, args, false];
  const result = spawnSync(command, argv, {
    cwd: root,
    encoding: "utf8",
    shell,
    env: { ...process.env, ...options.env },
  });
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    throw new Error(`pnpm ${args.join(" ")} failed (exit ${result.status ?? result.error})`);
  }
}

const normalise = (text) => text.replaceAll("\r\n", "\n");
const read = (file) => (existsSync(file) ? normalise(readFileSync(file, "utf8")) : null);

function firstDifference(a, b) {
  const left = (a ?? "").split("\n");
  const right = (b ?? "").split("\n");
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    if (left[i] !== right[i]) {
      return `line ${i + 1}\n  committed: ${left[i] ?? "(end of file)"}\n  generated: ${right[i] ?? "(end of file)"}`;
    }
  }
  return "no textual difference";
}

// Scratch space inside the (gitignored) root node_modules: `sanity schema extract --path` is
// resolved relative to apps/studio, so a path under the repository keeps it portable.
mkdirSync(join(root, "node_modules/.cache"), { recursive: true });
// `sanity schema extract` leaves a runtime folder in apps/studio; remove it unless it was there.
const studioRuntime = join(root, "apps/studio/.sanity");
const hadStudioRuntime = existsSync(studioRuntime);
const tmp = mkdtempSync(join(root, "node_modules/.cache/cms-types-"));
const committed = { schema: read(schemaFile), types: read(typesFile) };
const originals = {
  schema: existsSync(schemaFile) ? readFileSync(schemaFile) : null,
  types: existsSync(typesFile) ? readFileSync(typesFile) : null,
};
let fresh;
try {
  const freshSchema = join(tmp, "schema.json");
  pnpm(
    [
      "--filter",
      "@vitalos/studio",
      "exec",
      "sanity",
      "schema",
      "extract",
      "--path",
      relative(join(root, "apps/studio"), freshSchema).replaceAll("\\", "/"),
      "--enforce-required-fields",
    ],
    { env: { SANITY_SCHEMA_EXTRACT: "1" } },
  );
  // Typegen reads the schema from its configured location; swap the fresh one in for the run.
  copyFileSync(freshSchema, schemaFile);
  pnpm(["--filter", "@vitalos/cms", "exec", "sanity", "typegen", "generate"]);
  fresh = { schema: read(freshSchema), types: read(typesFile) };
  copyFileSync(typesFile, join(tmp, "sanity.types.ts"));
} finally {
  if (!write) {
    // Restore the committed files exactly (also after a failure).
    for (const [file, content] of [
      [schemaFile, originals.schema],
      [typesFile, originals.types],
    ]) {
      if (content === null) rmSync(file, { force: true });
      else writeFileSync(file, content);
    }
  }
  rmSync(tmp, { recursive: true, force: true });
  if (!hadStudioRuntime) rmSync(studioRuntime, { recursive: true, force: true });
}

if (write) {
  console.log("Regenerated packages/cms/src/generated/{schema.json,sanity.types.ts}.");
  process.exit(0);
}

const drift = [];
if (fresh.schema !== committed.schema) {
  drift.push(
    `packages/cms/src/generated/schema.json\n${firstDifference(committed.schema, fresh.schema)}`,
  );
}
if (fresh.types !== committed.types) {
  drift.push(
    `packages/cms/src/generated/sanity.types.ts\n${firstDifference(committed.types, fresh.types)}`,
  );
}
if (drift.length > 0) {
  console.error(
    `CMS types are out of date with the schema or the GROQ queries:\n\n${drift.join("\n\n")}`,
  );
  console.error("\nRun `node tooling/scripts/check-cms-types.mjs --write` and commit the result.");
  process.exit(1);
}
console.log("CMS types are up to date.");
