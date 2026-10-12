import { readFileSync, writeFileSync } from "node:fs";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { fluid, kebab, renderTailwindThemeCss, renderThemeCss } from "./css";
import { colors, tints } from "./primitives";

const REGENERATE =
  "Generated CSS is out of date. Run: UPDATE_TOKENS=1 corepack pnpm --filter @vitalos/design-tokens test";

/** The committed files are prettier-formatted (repo format:check), so compare formatted output. */
const pretty = (css: string): Promise<string> => format(css, { parser: "css", printWidth: 100 });

const expectedTheme = await pretty(renderThemeCss());
const expectedTailwindTheme = await pretty(renderTailwindThemeCss());

if (process.env.UPDATE_TOKENS === "1") {
  writeFileSync(new URL("./theme.css", import.meta.url), expectedTheme);
  writeFileSync(new URL("./tailwind-theme.css", import.meta.url), expectedTailwindTheme);
}

const read = (name: string): string => readFileSync(new URL(name, import.meta.url), "utf8");
const themeCss = read("./theme.css");
const tailwindThemeCss = read("./tailwind-theme.css");

describe("generated CSS stays in sync with the TypeScript tokens", () => {
  it("theme.css matches the generated output", () => {
    expect(themeCss, REGENERATE).toBe(expectedTheme);
  });

  it("tailwind-theme.css matches the generated output", () => {
    expect(tailwindThemeCss, REGENERATE).toBe(expectedTailwindTheme);
  });

  it("exposes every brand colour as a CSS variable with its exact value", () => {
    for (const [key, value] of Object.entries(colors)) {
      expect(themeCss.toLowerCase()).toContain(`--color-${kebab(key)}: ${value.toLowerCase()};`);
    }
  });

  it("exposes every tint as a CSS variable and a Tailwind colour", () => {
    for (const [key, value] of Object.entries(tints)) {
      const declaration = `--color-${kebab(key)}: ${value.toLowerCase()};`;
      expect(themeCss.toLowerCase()).toContain(declaration);
      expect(tailwindThemeCss.toLowerCase()).toContain(declaration);
    }
  });

  it("defines the three tone scopes and a focus rule", () => {
    expect(themeCss).toContain('[data-tone="muted"]');
    expect(themeCss).toContain('[data-tone="dark"]');
    expect(themeCss).toContain(":focus-visible");
    expect(themeCss).toContain("prefers-reduced-motion");
  });

  it("only animates the hero process card when motion is allowed", () => {
    const start = themeCss.indexOf("@media (prefers-reduced-motion: no-preference)");
    expect(start).toBeGreaterThan(-1);
    // Every hv-* animation rule sits inside the no-preference gate, none before it.
    expect(themeCss.slice(0, start)).not.toMatch(/\.hv-[a-z]+ \{/);
    expect(themeCss.slice(start)).toContain("animation: hv-card");
  });

  it("never loops hero motion forever (WCAG 2.2.2: motion stops within seconds)", () => {
    const start = themeCss.indexOf("@media (prefers-reduced-motion: no-preference)");
    const hero = themeCss.slice(start, themeCss.indexOf("}\n}", start));
    expect(hero).toContain("hv-wave");
    expect(hero).not.toContain("infinite");
  });
});

describe("helpers", () => {
  it("kebab-cases token keys", () => {
    expect(kebab("midnight950")).toBe("midnight-950");
    expect(kebab("displayXl")).toBe("display-xl");
    expect(kebab("h1")).toBe("h1");
    expect(kebab("actionHover")).toBe("action-hover");
  });

  it("builds a fluid clamp between the two sizes", () => {
    expect(fluid(16, 16)).toBe("1rem");
    expect(fluid(16, 48)).toBe("clamp(1rem, calc(0.3333rem + 3.3333vw), 3rem)");
  });
});
