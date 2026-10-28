#!/usr/bin/env node
// Email guard (AGENTS.md "Email", docs/email/README.md): every email goes through the shared layout,
// so only each application's one mailer module may call a mail API. Fails when any other file does.
// A justified exception goes in tooling/email-senders.allow as "<path> | <reason>".
//
//   node tooling/scripts/check-email-senders.mjs
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");

/** The mailer modules: the only files allowed to call a mail API. */
const MAILERS = new Set([
  "superadmin/apps/mailer/messages.py", // build_message: layout render → Django message
  "superadmin/apps/mailer/backends.py", // Django backends: log and Resend
  "apps/web/src/features/enquiries/adapters/email-notifier.ts", // website notifications (Resend, Postmark)
  "packages/relay-core/src/notify/mailer.ts", // Relay visitor email (Resend)
]);

const PATTERNS = {
  py: [
    /\bEmailMessage\s*\(/,
    /\bEmailMultiAlternatives\s*\(/,
    /\bsend_mail\s*\(/,
    /\bsend_mass_mail\s*\(/,
    /\bmail_admins\s*\(/,
    /\bmail_managers\s*\(/,
    /api\.resend\.com/,
    /\bresend\.Emails\.send\b/,
    /\bsmtplib\b/,
    /graph\.microsoft\.com[^"'\s]*\/sendMail/,
  ],
  ts: [
    /\bresend\.emails\.send\b/,
    /\bnew\s+Resend\s*\(/,
    /api\.resend\.com/,
    /api\.postmarkapp\.com/,
    /graph\.microsoft\.com[^"'\s]*\/sendMail/,
    /from\s+["']nodemailer["']|require\(\s*["']nodemailer["']\s*\)/,
  ],
};

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".venv",
  "venv",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  "migrations",
  "__pycache__",
  "storybook-static",
  "playwright-report",
  "test-results",
]);
const isTest = (path) =>
  /(^|\/)(tests?|e2e|__tests__)\//.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(path);

function allowList() {
  const entries = new Map();
  const text = readFileSync(join(root, "tooling/email-senders.allow"), "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [path, reason] = trimmed.split("|").map((part) => part.trim());
    if (!path || !reason)
      throw new Error(`tooling/email-senders.allow: "${trimmed}" needs "<path> | <reason>"`);
    entries.set(path, reason);
  }
  return entries;
}

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* files(join(dir, entry.name));
    } else if (/\.(py|[cm]?[jt]sx?)$/.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

const allowed = allowList();
const self = "tooling/scripts/check-email-senders.mjs";
const problems = [];
for (const file of files(root)) {
  const path = relative(root, file).split("\\").join("/");
  if (path === self || isTest(path) || MAILERS.has(path) || allowed.has(path)) continue;
  const patterns = path.endsWith(".py") ? PATTERNS.py : PATTERNS.ts;
  readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, index) => {
      if (/^\s*(#|\/\/|\*)/.test(line)) return; // comments may name the APIs
      for (const pattern of patterns) {
        if (pattern.test(line)) problems.push(`${path}:${index + 1}: ${line.trim()}`);
      }
    });
}

if (problems.length) {
  console.error("Email guard: only the mailer modules may call a mail API (AGENTS.md, Email).");
  console.error(
    "Send through the layout instead, or add '<path> | <reason>' to tooling/email-senders.allow.\n",
  );
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log(
  `Email guard: ok (${MAILERS.size} mailer modules, ${allowed.size} allowed exceptions).`,
);
