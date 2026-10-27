// Screenshots and contact sheets for the email gallery (docs/email/README.md).
//
//   node scripts/email-gallery-shots.mjs <gallery-dir> [--sheets <dir>] [--only <category,...>]
//
// For every email in <gallery-dir>/manifest.json: full-page screenshots at 600px and 390px wide in the
// light and dark colour schemes (<gallery-dir>/shots/<slug>.<scheme>.<width>.png). Then one JPEG contact
// sheet per category (light and dark side by side, top of each email), kept at 2 MB or less, written to
// --sheets (default <gallery-dir>/contact-sheets).
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const gallery = resolve(args[0] ?? "docs/email/gallery");
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const sheets = resolve(flag("--sheets") ?? join(gallery, "contact-sheets"));
const only = flag("--only")?.split(",");
const MAX_SHEET_BYTES = 2 * 1024 * 1024;

const manifest = JSON.parse(readFileSync(join(gallery, "manifest.json"), "utf8")).filter(
  (entry) => !only || only.includes(entry.category),
);
mkdirSync(join(gallery, "shots"), { recursive: true });
mkdirSync(sheets, { recursive: true });

// EMAIL_SHOTS_CHROMIUM points at a browser outside the Playwright cache (for example a CI image).
const browser = await chromium.launch(
  process.env.EMAIL_SHOTS_CHROMIUM ? { executablePath: process.env.EMAIL_SHOTS_CHROMIUM } : {},
);
for (const scheme of ["light", "dark"]) {
  const context = await browser.newContext({ colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const width of [600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const entry of manifest) {
      await page.goto(pathToFileURL(join(gallery, entry.html)).href);
      await page.screenshot({
        path: join(gallery, "shots", `${entry.slug}.${scheme}.${width}.png`),
        fullPage: true,
      });
    }
  }
  await context.close();
}

const escape = (value) =>
  String(value).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const categories = [...new Set(manifest.map((entry) => entry.category))].sort();
const sheetPage = await browser.newPage({ viewport: { width: 1280, height: 800 } });
for (const category of categories) {
  const entries = manifest.filter((entry) => entry.category === category);
  const shot = (entry, scheme) => pathToFileURL(join(gallery, "shots", `${entry.slug}.${scheme}.600.png`)).href;
  const cells = entries
    .map(
      (entry) => `<figure><figcaption><b>${escape(entry.name)}</b><br>${escape(entry.subject)}</figcaption>
<div class="pair"><div class="crop"><img src="${shot(entry, "light")}"></div><div class="crop"><img src="${shot(entry, "dark")}"></div></div></figure>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:24px;background:#eef1f5;font:14px/1.4 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#0f172a}
h1{margin:0 0 16px;font-size:20px} main{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
figure{margin:0;background:#fff;border:1px solid #d9e0e8;border-radius:8px;padding:10px}
figcaption{margin:0 0 8px;font-size:13px;color:#334155;height:36px;overflow:hidden}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px} .crop{height:520px;overflow:hidden;border:1px solid #d9e0e8}
.crop img{display:block;width:100%}
</style></head><body><h1>${escape(category)} (${entries.length} emails, light and dark, 600px)</h1><main>${cells}</main></body></html>`;
  const file = join(sheets, `${category}.html`);
  writeFileSync(file, html);
  await sheetPage.goto(pathToFileURL(file).href);
  await sheetPage.waitForLoadState("load");
  const out = join(sheets, `${category}.jpg`);
  for (const quality of [70, 55, 40, 30]) {
    await sheetPage.screenshot({ path: out, fullPage: true, type: "jpeg", quality });
    if (statSync(out).size <= MAX_SHEET_BYTES) break;
  }
  const size = statSync(out).size;
  console.log(`${category}: ${entries.length} emails, ${(size / 1024).toFixed(0)} KB`);
  if (size > MAX_SHEET_BYTES) console.warn(`  ${category}.jpg is over 2 MB`);
}
await browser.close();
console.log(`Screenshots in ${join(gallery, "shots")}; contact sheets in ${sheets}`);
