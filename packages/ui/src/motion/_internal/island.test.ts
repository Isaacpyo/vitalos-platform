import { describe, expect, it } from "vitest";
import { durations, easing } from "@vitalos/design-tokens";
import { EASE_EMPHASIS, SECONDS } from "./island";

describe("Motion island timing", () => {
  it("mirrors the design-token durations and emphasis easing exactly", () => {
    for (const [name, ms] of Object.entries(durations)) {
      expect(SECONDS[name as keyof typeof SECONDS] * 1000, name).toBe(ms);
    }
    expect(`cubic-bezier(${EASE_EMPHASIS.join(", ")})`).toBe(easing.emphasis);
  });
});
