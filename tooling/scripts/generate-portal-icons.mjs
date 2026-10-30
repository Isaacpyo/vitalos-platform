#!/usr/bin/env node
/**
 * Client portal app icons (ADR-056, Phase 1: installable app).
 *
 * The Vitalos symbol is NOT redrawn: the original raster (apps/web/public/brand/vitalos-symbol-512.png) is placed,
 * scaled and centred on its own visible bounds, on a tile in the portal header colour (--aid-ink-950), and Chromium
 * screenshots each tile at its exact pixel size.
 *
 *   icon-192.png, icon-512.png   rounded tile, transparent corners ("any" purpose: desktop, launchers)
 *   maskable-512.png             full-bleed tile, mark inside the 80% safe zone (Android adaptive icons)
 *   apple-touch-icon-180.png     full-bleed square, no transparency (iOS applies its own mask)
 *   badge-96.png                 the mark alone as a white silhouette on transparency: the push notification badge
 *                                (Android draws only its alpha in the status bar; ADR-056, Phase 2)
 *
 * Regenerate from the repository root after the symbol or the tile colour changes, then commit the PNGs:
 *   node tooling/scripts/generate-portal-icons.mjs                 # every icon
 *   node tooling/scripts/generate-portal-icons.mjs badge-96.png    # only the named files
 * Needs Playwright's Chromium (the root devDependency @playwright/test after `pnpm install`, or a global
 * `playwright` on NODE_PATH). No other packages.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SOURCE = join(repoRoot, "apps/web/public/brand/vitalos-symbol-512.png");
const OUT_DIR = join(repoRoot, "superadmin/static/portal/icons");
const TILE = "#0a0c0f"; // --aid-ink-950 in superadmin/static/portal/portal.css (the portal header)

// size: output pixels; mark: the mark's width as a share of the tile; radius: corner radius as a share (0 = square);
// badge: no tile, the mark drawn as a white silhouette.
const ALL_ICONS = [
  { file: "icon-192.png", size: 192, mark: 0.62, radius: 0.22 },
  { file: "icon-512.png", size: 512, mark: 0.62, radius: 0.22 },
  { file: "maskable-512.png", size: 512, mark: 0.54, radius: 0 },
  { file: "apple-touch-icon-180.png", size: 180, mark: 0.62, radius: 0 },
  { file: "badge-96.png", size: 96, mark: 0.78, radius: 0, badge: true },
];
const only = process.argv.slice(2);
const unknown = only.filter((name) => !ALL_ICONS.some((icon) => icon.file === name));
if (unknown.length) throw new Error(`Unknown icon: ${unknown.join(", ")}`);
const ICONS = only.length ? ALL_ICONS.filter((icon) => only.includes(icon.file)) : ALL_ICONS;

function loadChromium() {
  const require = createRequire(join(repoRoot, "package.json"));
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      return require(name).chromium;
    } catch {
      // try the next one
    }
  }
  throw new Error("Playwright is not installed: run `pnpm install` at the repository root.");
}

const symbol = `data:image/png;base64,${readFileSync(SOURCE).toString("base64")}`;
const chromium = loadChromium();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent("<!doctype html><body style='margin:0'></body>");
  // The mark's visible bounds inside the source (alpha above a small threshold), so it is centred optically.
  const bounds = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 8) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
      }
    }
    return { width, height, x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }, symbol);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const icon of ICONS) {
    const scale = (icon.size * icon.mark) / bounds.w;
    const left = icon.size / 2 - (bounds.x0 + bounds.w / 2) * scale;
    const top = icon.size / 2 - (bounds.y0 + bounds.h / 2) * scale;
    const radius = icon.radius ? `${icon.size * icon.radius}px` : "0";
    const tile = icon.badge ? "transparent" : TILE;
    const silhouette = icon.badge ? "filter:brightness(0) invert(1);" : "";
    await page.setViewportSize({ width: icon.size, height: icon.size });
    await page.setContent(`<!doctype html>
      <body style="margin:0;background:transparent">
        <div id="tile" style="position:relative;overflow:hidden;width:${icon.size}px;height:${icon.size}px;background:${tile};border-radius:${radius}">
          <img src="${symbol}" alt="" style="position:absolute;left:${left}px;top:${top}px;width:${bounds.width * scale}px;height:${bounds.height * scale}px;${silhouette}">
        </div>
      </body>`);
    await page.evaluate(() => document.querySelector("img").decode());
    const png = await page.locator("#tile").screenshot({ omitBackground: true });
    writeFileSync(join(OUT_DIR, icon.file), png);
    console.log(`Wrote superadmin/static/portal/icons/${icon.file} (${icon.size}x${icon.size})`);
  }
} finally {
  await browser.close();
}
