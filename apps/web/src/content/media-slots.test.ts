import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { mediaSlots, renderImageSlotsDoc } from "./media-slots";

const repoRoot = path.resolve(__dirname, "../../../..");

/** Table cells compared without Prettier's column padding. */
const normalise = (markdown: string): string =>
  markdown
    .split("\n")
    .map((line) =>
      line
        .replace(/\s*\|\s*/g, "|")
        .replace(/-{3,}/g, "---")
        .trimEnd(),
    )
    .join("\n")
    .trim();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });
}

describe("image slot registry", () => {
  it("has unique ids, each with a brief and draft alt text", () => {
    const ids = mediaSlots.map((slot) => slot.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const slot of mediaSlots) {
      expect(slot.brief.trim()).not.toBe("");
      expect(slot.alt.trim()).not.toBe("");
    }
  });

  it("docs/design/IMAGE-SLOTS.md is up to date (run pnpm media:slots)", () => {
    const doc = readFileSync(path.join(repoRoot, "docs/design/IMAGE-SLOTS.md"), "utf8");
    expect(normalise(doc)).toBe(normalise(renderImageSlotsDoc()));
  });

  it("every MediaSlot in the app names a registered id", () => {
    const registered = new Set<string>(mediaSlots.map((slot) => slot.id));
    const used = sourceFiles(path.resolve(__dirname, "..")).flatMap((file) =>
      Array.from(
        readFileSync(file, "utf8").matchAll(/<MediaSlot[^>]*\bid="([^"]+)"/g),
        (m) => m[1],
      ),
    );
    for (const id of used) expect(registered.has(id ?? ""), `unregistered slot ${id}`).toBe(true);
  });
});
