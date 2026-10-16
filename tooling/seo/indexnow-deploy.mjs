#!/usr/bin/env node
// IndexNow ping after a production deployment (.github/workflows/indexnow.yml,
// docs/seo/DECISIONS.md 14). Reads the live sitemap and sends the URLs whose content date
// (`lastmod`) is on or after --since: what changed since the previous production deployment. With
// no --since it sends every sitemap URL (the first run). No secret is needed: the key is the public
// key file the site serves. Exits 0 on any failure, so it never blocks anything.
//
//   node tooling/seo/indexnow-deploy.mjs --site https://vitalos.co.uk [--since ISO] [--dry-run]
import { parseArgs } from "node:util";
import { submitIndexNow, INDEXNOW_KEY_PATH } from "../../apps/web/src/features/seo/indexnow.ts";
import { readSitemap } from "./fetch.mjs";

const { values } = parseArgs({
  options: {
    site: { type: "string" },
    since: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
if (!values.site) {
  console.error("usage: indexnow-deploy.mjs --site <canonical origin> [--since ISO] [--dry-run]");
  process.exitCode = 2;
}
async function main() {
  const site = new URL(values.site).origin;
  const keyResponse = await fetch(new URL(INDEXNOW_KEY_PATH, site)).catch(() => null);
  if (!keyResponse?.ok) {
    console.log(`::notice::No IndexNow key at ${site}${INDEXNOW_KEY_PATH}; nothing sent.`);
    return;
  }
  const key = (await keyResponse.text()).trim();

  const { urls } = await readSitemap(site, "/sitemap.xml", {});
  const since = values.since ? Date.parse(values.since) : Number.NaN;
  const changed = urls
    .filter((u) => Number.isNaN(since) || (u.lastmod && Date.parse(u.lastmod) >= since))
    .map((u) => u.loc);

  console.log(
    `${urls.length} sitemap URLs; ${changed.length} changed${Number.isNaN(since) ? " (no --since: all)" : ` since ${values.since}`}.`,
  );
  if (changed.length === 0 || values["dry-run"]) {
    for (const url of changed) console.log(`  ${url}`);
    return;
  }
  const statuses = await submitIndexNow({ siteUrl: site, key, urls: changed });
  console.log(`IndexNow answered ${statuses.join(", ")} (200 or 202 means accepted).`);
  if (!statuses.every((s) => s === 200 || s === 202)) {
    console.log("::warning::IndexNow did not accept every batch; it only delays recrawling.");
  }
}

if (values.site)
  await main().catch((error) => {
    console.log(
      `::warning::IndexNow ping skipped: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
