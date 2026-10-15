import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { HeroVisual } from "./HeroVisual";

afterEach(cleanup);

describe("HeroVisual process card", () => {
  const steps = ["Step one", "Step two", "Step three", "Step four"];

  it("renders every step's text and the five bars in their final state", () => {
    const { container } = render(<HeroVisual steps={steps} />);
    for (const step of steps) expect(container.textContent).toContain(step);
    expect(container.querySelectorAll(".hv-bar")).toHaveLength(5);
    // The tick is drawn by default; only the animation starts it undrawn.
    const tick = container.querySelector(".hv-tick");
    expect(tick?.getAttribute("stroke-dashoffset")).toBe("0");
    // One pulse ring, on the last step only, invisible at rest.
    const rings = container.querySelectorAll(".hv-ring");
    expect(rings).toHaveLength(1);
    expect(rings[0]?.className).toContain("opacity-0");
  });

  it("stays decorative and omits the card without steps", () => {
    const { container } = render(<HeroVisual />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelector(".hv-card")).toBeNull();
  });

  it("glass: every step on the panel, no tint planes, idle loops on the panel only", () => {
    const steps = ["Assess", "Build", "Run"];
    const { container } = render(<HeroVisual steps={steps} variant="glass" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(container.querySelectorAll('[class*="skew-x-12"]')).toHaveLength(0);
    expect(Array.from(container.querySelectorAll("li"), (li) => li.textContent)).toEqual(steps);
    expect(container.querySelectorAll(".hv-pulse")).toHaveLength(1);
    expect(container.querySelectorAll(".hv-bar-idle")).toHaveLength(5);
    expect(container.querySelector(".hv-float .hv-card")).not.toBeNull();
  });
});
