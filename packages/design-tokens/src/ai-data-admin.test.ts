import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { adminContrastPairs, renderAdminAiDataCss } from "./ai-data-admin";
import { contrastRatio } from "./contrast";

const target = new URL("../../../superadmin/assets/ai-data-tokens.css", import.meta.url);
const expected = await format(renderAdminAiDataCss(), { parser: "css", printWidth: 100 });
if (process.env.UPDATE_TOKENS === "1") writeFileSync(target, expected);

describe("Super Admin AI & Data tokens", () => {
  it("superadmin/assets/ai-data-tokens.css matches the generated output", () => {
    expect(
      readFileSync(target, "utf8"),
      "Run: UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test",
    ).toBe(expected);
  });

  it("follows the admin theme switch and maps Tailwind colours", () => {
    expect(expected).toContain('[data-theme="dark"] [data-aid-admin]');
    expect(expected).toContain('[data-theme="system"] [data-aid-admin]');
    expect(expected).toContain("--color-aid-surface: var(--aid-surface);");
    expect(expected).toContain("--color-aid-warn-bg: var(--aid-warn-bg);");
  });

  it("keeps motion at or under 200 ms", () => {
    const values = [...expected.matchAll(/--aid-motion-[a-z]+: (\d+)ms/g)].map((m) => Number(m[1]));
    expect(values.length).toBeGreaterThan(0);
    for (const ms of values) expect(ms).toBeLessThanOrEqual(200);
  });

  it.each(adminContrastPairs().map((p) => [p.name, p] as const))(
    "%s meets its minimum ratio",
    (_name, pair) => {
      const ratio = contrastRatio(pair.fg, pair.bg);
      expect(
        ratio,
        `${pair.name}: ${ratio.toFixed(2)}:1 (needs ${pair.min}:1)`,
      ).toBeGreaterThanOrEqual(pair.min);
    },
  );
});
