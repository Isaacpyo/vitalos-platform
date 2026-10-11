#!/usr/bin/env node
// Writes the draft editorial content (packages/cms/src/draft, ADR-025) as a Sanity NDJSON dataset
// for the owner to import later:
//
//   node tooling/scripts/export-draft-dataset.mjs           write tooling/content/draft-dataset.ndjson
//   node tooling/scripts/export-draft-dataset.mjs --check   fail if the committed file is stale
//   node tooling/scripts/export-draft-dataset.mjs --include-placeholders
//       also export the INVENTED placeholder personas, insights, case study scenarios and role to
//       tooling/content/draft-dataset.with-placeholders.ndjson (never committed; default is off).
//       Never import that file as real content (ADR-025).
//
// Every document is a Sanity draft (`drafts.` id, editorialStatus "draft"), so an import publishes
// nothing. This script never talks to Sanity: importing is an owner-run step, for example
//   sanity dataset import tooling/content/draft-dataset.ndjson <dataset>
// in the owner's own session (it is a forbidden dataset command for agents; handoff §2).
//
// Node 24 strips TypeScript types natively; the resolve hook below adds the `.ts` extension to the
// extensionless relative imports the workspace uses.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { register } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hook = `
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (specifier.startsWith(".") && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return await next(specifier + suffix, context);
        } catch {}
      }
    }
    throw error;
  }
}`;
register(`data:text/javascript,${encodeURIComponent(hook)}`, import.meta.url);

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const target = join(root, "tooling/content/draft-dataset.ndjson");
const entry = pathToFileURL(join(root, "packages/cms/src/draft/index.ts")).href;

const { draftContent, toNdjson, toSanityDocuments } = await import(entry);
const includePlaceholders = process.argv.includes("--include-placeholders");
const documents = toSanityDocuments(draftContent, { includePlaceholders });
const text = toNdjson(documents);

if (process.argv.includes("--check")) {
  if (includePlaceholders) {
    console.error("--check verifies the committed default export; do not combine the flags.");
    process.exit(1);
  }
  let committed = "";
  try {
    committed = readFileSync(target, "utf8").replaceAll("\r\n", "\n");
  } catch {
    // Missing file: reported below.
  }
  if (committed !== text) {
    console.error(
      "tooling/content/draft-dataset.ndjson is out of date. Run: node tooling/scripts/export-draft-dataset.mjs",
    );
    process.exit(1);
  }
  console.log(`draft-dataset.ndjson is current (${documents.length} documents).`);
} else if (includePlaceholders) {
  // Placeholders never go into the committed file: write a separate, ignored one.
  const placeholderTarget = join(root, "tooling/content/draft-dataset.with-placeholders.ndjson");
  mkdirSync(dirname(placeholderTarget), { recursive: true });
  writeFileSync(placeholderTarget, text);
  console.warn(
    `Wrote ${documents.length} documents INCLUDING invented placeholders to tooling/content/draft-dataset.with-placeholders.ndjson. Do not import it as real content.`,
  );
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`Wrote ${documents.length} draft documents to tooling/content/draft-dataset.ndjson`);
}
