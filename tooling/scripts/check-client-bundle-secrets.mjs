// Fails when the client bundle contains server-only environment variable names or secret-like
// values. Scans apps/web/.next/static (everything the browser can download) after `next build`.
//
// Server-only names come from the @vitalos/config schema (every key that is not NEXT_PUBLIC_*),
// so a new server secret is covered automatically. Secret-like patterns catch values that were
// pasted or inlined without going through the schema.
//
// Usage: node tooling/scripts/check-client-bundle-secrets.mjs [directory]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const defaultDir = join(root, "apps/web/.next/static");

// Not secrets, and may be inlined by tooling: never flag these names.
const NON_SECRET_NAMES = new Set(["VERCEL_ENV", "VERCEL_URL"]);
const SCANNED = new Set([".js", ".mjs", ".css", ".json", ".html", ".txt", ".map"]);

/** @returns {Promise<string[]>} server-only env var names, from the validated config schema. */
export async function serverEnvNames() {
  // Node 24 strips TypeScript types, so the schema is the single source of truth.
  const schema = await import(new URL("../../packages/config/src/schema.ts", import.meta.url).href);
  return schema.envKeys.filter(
    (name) => !name.startsWith("NEXT_PUBLIC_") && !NON_SECRET_NAMES.has(name),
  );
}

/** Patterns for credential-shaped values. Each has a label used in the report. */
export const secretPatterns = [
  { label: "private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { label: "Stripe-style live/test secret", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}/ },
  { label: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{16,}/ },
  {
    label: "Supabase service_role assignment",
    pattern: /\bservice_role\b["']?\s*[:=]\s*["'][A-Za-z0-9._-]{20,}/,
  },
  {
    label: "JWT (possible service key or token)",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  },
  { label: "AWS access key id", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { label: "Sanity API token", pattern: /\bsk[A-Za-z0-9]{50,}\b/ },
  { label: "Resend API key", pattern: /\bre_[A-Za-z0-9_]{16,}/ },
  { label: "Bearer credential", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{32,}=*/ },
];

/**
 * @param {string} text
 * @param {string[]} names
 * @returns {{ label: string }[]} findings (labels only: matched values are never printed)
 */
export function scanText(text, names) {
  const findings = [];
  for (const name of names) {
    if (new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`).test(text)) {
      findings.push({ label: `server env var name ${name}` });
    }
  }
  for (const { label, pattern } of secretPatterns) {
    if (pattern.test(text)) findings.push({ label });
  }
  return findings;
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (SCANNED.has(extname(entry.name))) yield path;
  }
}

async function main() {
  const dir = resolve(process.argv[2] ?? defaultDir);
  try {
    statSync(dir);
  } catch {
    console.error(`Client bundle directory not found: ${dir}\nRun \`corepack pnpm build\` first.`);
    process.exit(2);
  }
  const names = await serverEnvNames();
  let files = 0;
  let failures = 0;
  for (const file of walk(dir)) {
    files += 1;
    for (const finding of scanText(readFileSync(file, "utf8"), names)) {
      failures += 1;
      console.error(`${relative(root, file)}: ${finding.label}`);
    }
  }
  if (files === 0) {
    console.error(`No files scanned under ${dir}; refusing to report success.`);
    process.exit(2);
  }
  if (failures > 0) {
    console.error(`Client bundle secret scan failed (${failures} finding(s) in ${files} files).`);
    process.exit(1);
  }
  console.log(
    `Client bundle secret scan passed (${files} files, ${names.length} server env names checked).`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
