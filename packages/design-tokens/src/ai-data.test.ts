import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { aiDataContrastPairs, aiDataPrimitives, aiDataTones, renderAiDataCss } from "./ai-data";
import { contrastRatio } from "./contrast";

const expected = await format(renderAiDataCss(), { parser: "css", printWidth: 100 });
if (process.env.UPDATE_TOKENS === "1")
  writeFileSync(new URL("./ai-data.css", import.meta.url), expected);

describe("Vitalos AI & Data tokens", () => {
  it("ai-data.css matches the generated output", () => {
    expect(
      readFileSync(new URL("./ai-data.css", import.meta.url), "utf8"),
      "Run: UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test",
    ).toBe(expected);
  });

  it("declares a scope per tone that re-points the site tone roles", () => {
    for (const tone of Object.keys(aiDataTones)) {
      expect(expected).toContain(`[data-aid-tone="${tone}"]`);
    }
    expect(expected).toContain("--tone-action: var(--aid-action);");
    expect(expected).toContain("--color-aid-bg: var(--aid-bg);");
  });

  it("uses #RRGGBB values only", () => {
    for (const value of Object.values(aiDataPrimitives)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("covers body text, headings, links, controls, actions, chips and statuses for every tone", () => {
    const pairs = aiDataContrastPairs();
    for (const tone of Object.keys(aiDataTones)) {
      for (const role of ["bg/text", "surface/text", "bg/muted", "bg/link", "bg/focus"]) {
        expect(pairs.some((p) => p.name === `${tone}/${role}`)).toBe(true);
      }
      for (const role of ["actionLabel", "controlText", "chip"]) {
        expect(pairs.some((p) => p.name === `${tone}/${role}`)).toBe(true);
      }
    }
    expect(pairs.filter((p) => p.name.startsWith("status/")).length).toBeGreaterThanOrEqual(4);
  });

  it.each(aiDataContrastPairs().map((p) => [p.name, p] as const))(
    "%s meets its minimum ratio",
    (_name, pair) => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(
        ratio,
        `${pair.name}: ${ratio.toFixed(2)}:1 (needs ${pair.min}:1)`,
      ).toBeGreaterThanOrEqual(pair.min);
    },
  );

  it("verifies the teal signal on every surface it sits on, and text on its tint", () => {
    const pairs = aiDataContrastPairs();
    for (const tone of Object.keys(aiDataTones)) {
      for (const role of [
        "bg/signal",
        "surface/signal",
        "textOnSignalSoft",
        "headingOnSignalSoft",
        "signalOnSignalSoft",
      ]) {
        expect(pairs.some((p) => p.name === `${tone}/${role}`)).toBe(true);
      }
    }
  });

  it("holds body text to AAA (7:1) on every band", () => {
    for (const pair of aiDataContrastPairs().filter((p) => p.name.endsWith("/text"))) {
      expect(contrastRatio(pair.fg, pair.bg), pair.name).toBeGreaterThanOrEqual(7);
    }
  });
});
