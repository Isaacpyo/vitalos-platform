#!/usr/bin/env node
// `pnpm media:product-snapshot` (docs/content/PRODUCT-PAGE-TEMPLATE.md): captures the snapshot of a
// Vitalos product's own public site for its product page, as the `products.{slug}.hero` slot.
//
//   pnpm media:product-snapshot --slug sob-autofix --url https://sobautofix.com/book \
//     --consent "Essential only" --hide 'a[href*="wa.me"]' --top 95 --mobile-top 85
//
// It captures the page at 1440x900 and 390x844 (device scale 2) with reduced motion and the web
// fonts loaded, clicks the cookie banner's decline button when `--consent` names it, blurs the
// focused element, hides the `--hide` selectors (chat launchers and other floating widgets), then
// crops to the slot's ratios (21:9 wide from `--top`, 5:7 phone from `--mobile-top`, in CSS px)
// and writes AVIF and WebP at full and half width to apps/web/public/media. Public pages only:
// never sign in, enter personal data or open account areas.
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "@playwright/test";

// sharp is Next.js's image library (pinned in pnpm-workspace.yaml): loaded from Next's install so
// the script adds no dependency of its own.
const fromWeb = createRequire(path.resolve(import.meta.dirname, "../../apps/web/package.json"));
const sharp = createRequire(fromWeb.resolve("next/package.json"))("sharp");

const { values } = parseArgs({
  options: {
    slug: { type: "string" },
    url: { type: "string" },
    key: { type: "string", default: "hero" },
    consent: { type: "string" },
    hide: { type: "string", multiple: true, default: [] },
    top: { type: "string", default: "0" },
    "mobile-top": { type: "string", default: "0" },
    wait: { type: "string", default: "3000" },
  },
});
if (!values.slug || !values.url) {
  console.error("Usage: pnpm media:product-snapshot --slug <slug> --url <https://...> [options]");
  process.exit(1);
}
if (new URL(values.url).protocol !== "https:") throw new Error("--url must be https");

const outDir = path.resolve(import.meta.dirname, "../../apps/web/public/media");
const file = `products.${values.slug}.${values.key}`;
const scale = 2;
// The slot's sizes (apps/web/src/content/media-slots.ts): 21:9 at 2030 x 870, phones 5:7 at
// 733 x 1026.
const captures = [
  { name: file, viewport: [1440, 900], ratio: 21 / 9, top: Number(values.top), size: [2030, 870] },
  {
    name: `${file}.mobile`,
    viewport: [390, 844],
    ratio: 5 / 7,
    top: Number(values["mobile-top"]),
    size: [733, 1026],
  },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
try {
  for (const capture of captures) {
    const [width, height] = capture.viewport;
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: scale,
      colorScheme: "light",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.goto(values.url, { waitUntil: "load", timeout: 60_000 });
    await page.waitForTimeout(Number(values.wait));
    if (values.consent) {
      await page
        .getByRole("button", { name: values.consent })
        .click({ timeout: 8_000 })
        .catch(() => console.warn(`No "${values.consent}" button on ${capture.name}`));
    }
    await page.evaluate(async (selectors) => {
      await document.fonts.ready;
      for (const selector of selectors) {
        for (const element of document.querySelectorAll(selector)) {
          if (element instanceof HTMLElement) element.style.visibility = "hidden";
        }
      }
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }, values.hide);
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1_500);
    const png = await page.screenshot();
    await context.close();

    const cropWidth = width * scale;
    const cropHeight = Math.round(cropWidth / capture.ratio);
    const top = Math.round(capture.top * scale);
    if (top + cropHeight > height * scale) {
      throw new Error(`${capture.name}: --top leaves less than the slot's height in the capture`);
    }
    const crop = sharp(png).extract({ left: 0, top, width: cropWidth, height: cropHeight });
    for (const [suffix, factor] of [
      ["", 1],
      ["@1x", 0.5],
    ]) {
      const resize = {
        width: Math.round(capture.size[0] * factor),
        height: Math.round(capture.size[1] * factor),
        fit: "cover",
      };
      const base = path.join(outDir, `${capture.name}${suffix}`);
      await crop.clone().resize(resize).avif({ quality: 55, effort: 6 }).toFile(`${base}.avif`);
      await crop.clone().resize(resize).webp({ quality: 78, effort: 6 }).toFile(`${base}.webp`);
    }
    console.log(`Wrote ${capture.name}{,@1x}.{avif,webp}`);
  }
} finally {
  await browser.close();
}
console.log(
  `Next: register "${file}" in apps/web/src/content/media-slots.ts (copy the Fauward entry), run pnpm media:slots, and look at every file before committing.`,
);
