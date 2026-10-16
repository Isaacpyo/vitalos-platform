#!/usr/bin/env node
// `pnpm seo:check` (docs/seo/LAUNCH.md §1, ADR-043): builds the site in production mode, serves it,
// crawls it as the canonical host (and once as a foreign host) and fails on any SEO regression.
//
//   pnpm seo:check                      build, serve, crawl, check
//   pnpm seo:check --skip-build         reuse apps/web/.next (it must be a production-mode build)
//   pnpm seo:check --lighthouse         also run Lighthouse per template against the budgets
//   pnpm seo:check --record docs/seo/crawl/after   also write the crawl as CSV and JSON
//   pnpm seo:check --live https://www.vitalos.co.uk   check a deployed site instead (no build)
//
// The local build uses repo content, no enquiry backend and NEXT_PUBLIC_SITE_URL
// https://vitalos.co.uk. It needs no secret, so it runs on fork pull requests.
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { validateJsonLd } from "../../apps/web/src/features/seo/json-ld-rules.ts";
import { crawlSite, fetchRaw, toCsv } from "./crawl.mjs";
import { checkBudgets, readBudgets, runLighthouse } from "./lighthouse.mjs";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")),
  "../..",
);
const { values } = parseArgs({
  options: {
    "skip-build": { type: "boolean", default: false },
    lighthouse: { type: "boolean", default: false },
    record: { type: "string" },
    live: { type: "string" },
    port: { type: "string", default: "3410" },
  },
});

const CANONICAL = values.live ? new URL(values.live).origin : "https://vitalos.co.uk";
const CANONICAL_HOST = new URL(CANONICAL).host;
const FOREIGN_HOST = "vitalos-platform.vercel.app";
const LIMITS = {
  titleMax: 60,
  descriptionMin: 120,
  descriptionMax: 155,
  depthMax: 3,
  minWords: 40,
};
const GENERIC_ANCHORS =
  /^(learn more|read more|more|click here|here|find out more|see more|view|details)$/i;
const KEY_PATHS = [
  "/",
  "/what-we-do",
  "/solutions",
  "/offers",
  "/industries",
  "/about",
  "/contact",
];

const buildEnv = {
  ...process.env,
  VITALOS_DEPLOY_ENV: "production",
  NEXT_PUBLIC_SITE_URL: CANONICAL,
  VITALOS_CONTENT_SOURCE: "repo",
  VITALOS_ENQUIRY_BACKEND: "disabled",
  INDEXNOW_KEY: "seo-check-local-key",
  NEXT_PUBLIC_ANALYTICS_PROVIDER: "none",
  NEXT_TELEMETRY_DISABLED: "1",
};

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`)),
    );
  });
}

async function waitFor(url, timeoutMs = 90_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const response = await fetchRaw(url, { timeoutMs: 5000 });
    if (response.status > 0) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server did not answer at ${url}`);
}

const failures = [];
const fail = (rule, detail) => failures.push(`${rule}: ${detail}`);

async function checkCrawl(origin, host) {
  const result = await crawlSite({ origin, host, canonicalOrigin: CANONICAL });
  const sitemapSet = new Set(result.sitemapPaths);
  const html = result.pages.filter((p) => p.page);
  const indexable = html.filter((p) => sitemapSet.has(p.path));

  if (result.sitemap.urls.length === 0) fail("sitemap", "no URLs listed");
  for (const file of result.sitemap.files)
    if (file.status !== 200) fail("sitemap", `${file.path} answers ${file.status}`);
  for (const loc of result.sitemap.urls.map((u) => u.loc)) {
    if (!loc.startsWith(`${CANONICAL}/`) && loc !== CANONICAL)
      fail("sitemap", `${loc} is not on ${CANONICAL}`);
  }

  for (const p of result.pages) {
    if (p.status >= 400 || p.status === 0)
      fail("broken link", `${p.path} answers ${p.status || p.error}`);
    if (p.hops.length > 1)
      fail("redirect chain", `${p.path}: ${p.hops.map((h) => `${h.status} ${h.to}`).join(" > ")}`);
    else if (p.hops.length === 1 && p.inbound > 0)
      fail("internal link redirects", `${p.path} → ${p.hops[0].to}`);
  }

  for (const p of html) {
    const pg = p.page;
    const h1s = pg.headings.filter((h) => h.level === 1);
    if (h1s.length !== 1) fail("h1", `${p.path} has ${h1s.length} h1 elements`);
    if (pg.lang !== "en-GB") fail("lang", `${p.path} has lang="${pg.lang}"`);
    for (const img of pg.images)
      if (img.alt === null) fail("image alt", `${p.path}: ${img.src} has no alt attribute`);
    for (const link of pg.links) {
      if (GENERIC_ANCHORS.test(link.text.trim()))
        fail("anchor text", `${p.path}: "${link.text}" → ${link.href}`);
    }
    for (const block of pg.jsonLd) if (!block.ok) fail("json-ld", `${p.path}: ${block.error}`);
  }

  const titles = new Map();
  const descriptions = new Map();
  for (const p of indexable) {
    const pg = p.page;
    const self = p.path === "/" ? CANONICAL : `${CANONICAL}${p.path}`;
    const robots = `${pg.robots} ${p.xRobotsTag}`.toLowerCase();
    if (p.status !== 200) fail("sitemap", `${p.path} answers ${p.status}`);
    if (/noindex/.test(robots))
      fail("noindex", `${p.path} is in the sitemap but says noindex (${robots.trim()})`);
    if (pg.canonicalCount !== 1)
      fail("canonical", `${p.path} has ${pg.canonicalCount} canonical links`);
    if (pg.canonical.replace(/\/$/, "") !== self.replace(/\/$/, ""))
      fail("canonical", `${p.path} → ${pg.canonical || "(none)"}`);
    if (!pg.title) fail("title", `${p.path} has no title`);
    else if (pg.title.length > LIMITS.titleMax)
      fail("title", `${p.path} is ${pg.title.length} characters: ${pg.title}`);
    if (!pg.description) fail("description", `${p.path} has no description`);
    else if (
      pg.description.length < LIMITS.descriptionMin ||
      pg.description.length > LIMITS.descriptionMax
    ) {
      fail("description", `${p.path} is ${pg.description.length} characters`);
    }
    titles.set(pg.title, [...(titles.get(pg.title) ?? []), p.path]);
    descriptions.set(pg.description, [...(descriptions.get(pg.description) ?? []), p.path]);
    if (p.inbound === 0 && p.path !== "/") fail("orphan", `${p.path} has no internal links to it`);
    if (p.depth === null || p.depth > LIMITS.depthMax)
      fail("depth", `${p.path} is ${p.depth ?? "unreachable"} clicks from the homepage`);
    if (pg.words < LIMITS.minWords)
      fail("server HTML", `${p.path} has ${pg.words} words without JavaScript`);
    if (!pg.og.image) fail("open graph", `${p.path} has no og:image`);
    if (pg.twitter.card !== "summary_large_image")
      fail("open graph", `${p.path} twitter:card is ${pg.twitter.card || "missing"}`);
    if (pg.og.url && pg.og.url.replace(/\/$/, "") !== self.replace(/\/$/, ""))
      fail("open graph", `${p.path} og:url ${pg.og.url}`);
    const issues = validateJsonLd(
      pg.jsonLd.filter((b) => b.ok).map((b) => b.data),
      {
        origin: CANONICAL,
        canonical: pg.canonical,
        h1: pg.headings.find((h) => h.level === 1)?.text,
        text: pg.visibleText,
      },
    );
    for (const issue of issues) fail("json-ld", `${p.path}: ${issue}`);
    if (pg.jsonLd.length === 0) fail("json-ld", `${p.path} has no structured data`);
  }
  for (const [title, paths] of titles)
    if (paths.length > 1) fail("duplicate title", `"${title}" on ${paths.join(", ")}`);
  for (const [text, paths] of descriptions)
    if (paths.length > 1)
      fail("duplicate description", `"${text.slice(0, 60)}…" on ${paths.join(", ")}`);

  // robots.txt on the canonical host: crawlable, with the sitemap; never blocking key paths.
  const robots = await fetchRaw(new URL("/robots.txt", origin).toString(), { host });
  const groups = robots.body.split(/\n\s*\n/);
  const star = groups.find((g) => /^user-agent:\s*\*\s*$/im.test(g)) ?? "";
  if (!/^sitemap:\s*\S+/im.test(robots.body))
    fail("robots", "production robots.txt lists no sitemap");
  for (const key of KEY_PATHS) {
    const blocked = [...star.matchAll(/^disallow:\s*(\S+)/gim)].some(
      ([, rule]) => key.startsWith(rule) && rule !== "/api/",
    );
    if (blocked) fail("robots", `production robots.txt blocks ${key}`);
  }
  if (/^disallow:\s*\/\s*$/im.test(star))
    fail("robots", "production robots.txt disallows everything for *");

  for (const file of ["/llms.txt"]) {
    const response = await fetchRaw(new URL(file, origin).toString(), { host });
    if (response.status !== 200) fail("llms.txt", `${file} answers ${response.status}`);
  }
  return result;
}

async function checkForeignHost(origin) {
  for (const p of ["/", "/what-we-do"]) {
    const response = await fetchRaw(new URL(p, origin).toString(), { host: FOREIGN_HOST });
    if (!/noindex/i.test(String(response.headers["x-robots-tag"] ?? ""))) {
      fail("preview host", `${FOREIGN_HOST}${p} is not noindexed`);
    }
  }
  const robots = await fetchRaw(new URL("/robots.txt", origin).toString(), { host: FOREIGN_HOST });
  if (!/^disallow:\s*\/\s*$/im.test(robots.body))
    fail("preview host", `${FOREIGN_HOST}/robots.txt does not disallow everything`);
}

let server;
try {
  let origin = CANONICAL;
  let host;
  if (!values.live) {
    const web = path.join(root, "apps", "web");
    if (!values["skip-build"])
      await run("corepack", ["pnpm", "--filter", "@vitalos/web", "exec", "next", "build"], {
        cwd: root,
        env: buildEnv,
      });
    origin = `http://127.0.0.1:${values.port}`;
    host = CANONICAL_HOST;
    server = spawn(
      "corepack",
      ["pnpm", "exec", "next", "start", "--hostname", "127.0.0.1", "--port", values.port],
      {
        cwd: web,
        env: buildEnv,
        stdio: "ignore",
        shell: process.platform === "win32",
        // Its own process group, so the whole tree (corepack, pnpm, next) stops at the end.
        detached: process.platform !== "win32",
      },
    );
    await waitFor(`${origin}/robots.txt`);
  }

  const result = await checkCrawl(origin, host);
  if (!values.live) await checkForeignHost(origin);

  if (values.record) {
    await mkdir(path.dirname(values.record), { recursive: true });
    await writeFile(`${values.record}.csv`, toCsv(result.pages));
    await writeFile(
      `${values.record}.json`,
      `${JSON.stringify({ crawledAt: new Date().toISOString(), origin: values.live ?? CANONICAL, sitemap: result.sitemap, pages: result.pages.map(({ page, ...rest }) => ({ ...rest, ...(page ? { page: { ...page, links: page.links.length, visibleText: undefined } } : {}) })) }, null, 2)}\n`,
    );
  }

  if (values.lighthouse && !values.live) {
    const budgets = await readBudgets();
    const results = await runLighthouse({ origin, templates: budgets.urls, skipCrawlable: true });
    console.table(
      results.map(({ failedSeoAudits, ...r }) => ({ ...r, seoFails: failedSeoAudits.join(" ") })),
    );
    for (const f of checkBudgets(results, budgets)) fail("lighthouse", f);
    if (values.record) {
      await writeFile(
        `${values.record}-lighthouse.json`,
        `${JSON.stringify({ origin: "local production build", results }, null, 2)}\n`,
      );
    }
  }

  const crawled = result.pages.length;
  const listed = result.sitemapPaths.length;
  if (failures.length === 0) {
    console.log(`seo:check passed: ${crawled} URLs crawled, ${listed} in the sitemap.`);
  } else {
    console.error(
      `seo:check failed with ${failures.length} problem(s) (${crawled} URLs crawled, ${listed} in the sitemap):`,
    );
    for (const f of failures) console.error(`  - ${f}`);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    `seo:check could not run: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
} finally {
  if (server) {
    if (process.platform === "win32")
      spawn("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(-server.pid, "SIGTERM");
  }
}
