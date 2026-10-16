import { describe, expect, it } from "vitest";
import { legacyAnchorTarget, legacyAnchors } from "./legacy-anchors";

const none = () => false;

describe("legacyAnchorTarget", () => {
  it("maps the fragments the brief names to their pages", () => {
    expect(legacyAnchorTarget("#what-we-do", none)).toBe("/what-we-do");
    expect(legacyAnchorTarget("#about", none)).toBe("/about");
  });

  it("is case-insensitive and ignores unknown or empty fragments", () => {
    expect(legacyAnchorTarget("#About", none)).toBe("/about");
    expect(legacyAnchorTarget("#main", none)).toBeNull();
    expect(legacyAnchorTarget("", none)).toBeNull();
    expect(legacyAnchorTarget("#", none)).toBeNull();
    expect(legacyAnchorTarget("#constructor", none)).toBeNull();
  });

  it("leaves a fragment alone when the page has that element", () => {
    expect(legacyAnchorTarget("#about", (id) => id === "about")).toBeNull();
  });

  it("only maps to same-site paths", () => {
    for (const target of Object.values(legacyAnchors)) expect(target).toMatch(/^\/[a-z-]*$/);
  });
});
