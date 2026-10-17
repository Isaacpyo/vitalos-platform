import { describe, expect, it } from "vitest";
import { turnstileThemeFor } from "./TurnstileWidget";

/** A stand-in element whose nearest tone scope has the given `data-tone` (or none). */
const inside = (tone: string | null): Element =>
  ({
    closest: (selector: string) =>
      selector === "[data-tone]" && tone !== null
        ? ({ getAttribute: (name: string) => (name === "data-tone" ? tone : null) } as Element)
        : null,
  }) as unknown as Element;

describe("turnstileThemeFor (finding A8)", () => {
  it("is light in the light contact form, whatever the operating system prefers", () => {
    expect(turnstileThemeFor(inside("muted"))).toBe("light");
    expect(turnstileThemeFor(inside("light"))).toBe("light");
    expect(turnstileThemeFor(inside(null))).toBe("light");
    expect(turnstileThemeFor(null)).toBe("light");
  });

  it("is dark only inside a dark tone scope", () => {
    expect(turnstileThemeFor(inside("dark"))).toBe("dark");
  });
});
