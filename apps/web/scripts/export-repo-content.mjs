// Writes the Insights and roles the `repo` content source serves as JSON for the Super Admin's
// `manage.py import_repo_content` (ADR-035 5, brief A7). Placeholders are never exported; today
// the repo source serves none, so the file holds empty lists.
//
//   pnpm content:export-repo [output.json]   (default: repo-content-export.json in the repo root)
//
// Run through Node's type stripping with scripts/ts-resolve.mjs (the workspace sources use
// extensionless imports).
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = resolve(root, process.argv[2] ?? "repo-content-export.json");

const { createRepoContentSource } = await import("@vitalos/cms/repo");
const { exportRepoContent } = await import("../src/features/content/export/repo-export.ts");
const data = await exportRepoContent(createRepoContentSource());
await writeFile(out, `${JSON.stringify(data, null, 2)}\n`);
console.log(`Wrote ${data.posts.length} posts and ${data.roles.length} roles to ${out}`);
