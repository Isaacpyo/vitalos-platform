import { describe, expect, it } from "vitest";
import { colors, contrastRatio, declaredContrastPairs, tones } from "./index";

describe("contrast helper", () => {
  it("matches known WCAG reference ratios", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
});

describe("declared text, surface and UI pairs", () => {
  const pairs = declaredContrastPairs();

  it("declares pairs for every tone", () => {
    for (const tone of Object.keys(tones)) {
      expect(pairs.some((p) => p.name.startsWith(`${tone}/`))).toBe(true);
    }
  });

  it.each(pairs.map((p) => [p.name, p] as const))("%s meets its minimum ratio", (_name, pair) => {
    const ratio = contrastRatio(pair.fg, pair.bg);
    expect(
      ratio,
      `${pair.name}: ${ratio.toFixed(2)}:1 (needs ${pair.min}:1)`,
    ).toBeGreaterThanOrEqual(pair.min);
  });
});

describe("documented limits", () => {
  it("keeps brand blue off midnight for body text (about 3.3:1, large text and non-text only)", () => {
    const ratio = contrastRatio(colors.blue600, colors.midnight950);
    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeLessThan(4.5);
    // No tone uses blue as a text colour on the dark surface.
    expect(tones.dark.text).not.toBe("blue600");
    expect(tones.dark.link).not.toBe("blue600");
    expect(tones.dark.muted).not.toBe("blue600");
  });

  it("keeps aqua off midnight for text", () => {
    expect(contrastRatio(colors.aqua600, colors.midnight950)).toBeLessThan(4.5);
    expect(tones.dark.accent).not.toBe("aqua600");
  });

  it("keeps the decorative rule colour below control-boundary contrast", () => {
    // #D9E1E8 is a divider colour only; form controls use controlBorder.
    expect(contrastRatio(colors.border, colors.white)).toBeLessThan(3);
    expect(tones.light.controlBorder).not.toBe("border");
  });

  it("uses the exact Stage 9 section 4 values", () => {
    expect(colors).toEqual({
      midnight950: "#081A2A",
      midnight800: "#173247",
      blue600: "#2457FF",
      blue700: "#1746DB",
      aqua600: "#007E76",
      cloud50: "#F7F9FC",
      white: "#FFFFFF",
      slate700: "#536273",
      slate900: "#26333F",
      border: "#D9E1E8",
      success: "#18794E",
      warning: "#9A6700",
      danger: "#C9372C",
    });
  });
});
