#!/usr/bin/env node
// Crawl a running site and write the crawl as CSV and JSON (docs/seo/crawl/).
//
//   node tooling/seo/crawl-cli.mjs --origin http://127.0.0.1:3310 --host vitalos.co.uk \
//     --canonical https://vitalos.co.uk --out docs/seo/crawl/after
//
// --origin     where to connect (a local `next start`, or the live site)
// --host       Host header to send (crawl a local build as the canonical host); optional
// --canonical  the site's canonical origin, used to resolve absolute links; optional
// --out        path prefix for <out>.csv and <out>.json
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { crawlSite, toCsv } from "./crawl.mjs";

const { values } = parseArgs({
  options: {
    origin: { type: "string" },
    host: { type: "string" },
    canonical: { type: "string" },
    out: { type: "string" },
    limit: { type: "string", default: "500" },
  },
});
if (!values.origin || !values.out) {
  console.error("usage: crawl-cli.mjs --origin <url> --out <prefix> [--host h] [--canonical url]");
  process.exit(2);
}

const result = await crawlSite({
  origin: values.origin,
  host: values.host,
  canonicalOrigin: values.canonical,
  limit: Number(values.limit),
});
await mkdir(path.dirname(values.out), { recursive: true });
await writeFile(`${values.out}.csv`, toCsv(result.pages));
const json = {
  crawledAt: new Date().toISOString(),
  origin: values.origin,
  host: values.host ?? null,
  sitemap: { files: result.sitemap.files, urls: result.sitemap.urls },
  pages: result.pages.map(({ page, ...rest }) => ({
    ...rest,
    ...(page ? { page: { ...page, links: page.links.length } } : {}),
  })),
};
await writeFile(`${values.out}.json`, `${JSON.stringify(json, null, 2)}\n`);
const ok = result.pages.filter((p) => p.status === 200).length;
console.log(`crawled ${result.pages.length} URLs (${ok} answered 200) -> ${values.out}.csv`);
