#!/usr/bin/env node
// Local outbox dispatcher: calls the internal dispatch endpoint of a running dev/start server.
//
//   OUTBOX_DISPATCH_SECRET=... node tooling/scripts/dispatch-outbox-local.mjs [--url http://localhost:3000] [--watch 30]
//
// The secret is read from the environment only (never from a file and never printed). The
// endpoint returns counts, never enquiry content. No scheduler runs in any deployed environment
// yet (Vercel Cron is blocked on owner approval), so this is the manual way to drain the outbox.

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const baseUrl = (
  option("--url") ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");
const secret = process.env.OUTBOX_DISPATCH_SECRET;
const watchSeconds = option("--watch") ? Number(option("--watch")) : undefined;

if (!secret) {
  console.error("OUTBOX_DISPATCH_SECRET is not set. Export it in this shell and retry.");
  process.exit(2);
}
if (watchSeconds !== undefined && !(watchSeconds >= 1)) {
  console.error("--watch needs a number of seconds (1 or more).");
  process.exit(2);
}

async function dispatchOnce() {
  const response = await fetch(`${baseUrl}/api/internal/outbox/dispatch`, {
    method: "POST",
    headers: { authorization: `Bearer ${secret}` },
  });
  const body = await response.json().catch(() => ({}));
  console.log(`${new Date().toISOString()} ${response.status} ${JSON.stringify(body)}`);
  return response.ok;
}

let ok;
try {
  ok = await dispatchOnce();
  while (watchSeconds !== undefined) {
    await new Promise((resolve) => setTimeout(resolve, watchSeconds * 1000));
    ok = await dispatchOnce();
  }
} catch (error) {
  console.error(`Dispatch request failed: ${error instanceof Error ? error.message : "unknown"}`);
  process.exit(1);
}
process.exit(ok ? 0 : 1);
