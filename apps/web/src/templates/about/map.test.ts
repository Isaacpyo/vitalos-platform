import { describe, expect, it } from "vitest";
import { evaluateGates } from "@vitalos/cms";
import { aboutLinks } from "./map";

describe("about mapping", () => {
  it("links to Careers only while its section is public", () => {
    expect(aboutLinks(evaluateGates({})).map((l) => l.key)).toEqual(["how-we-work", "trust"]);
    expect(aboutLinks(evaluateGates({ careers: 1 })).map((l) => l.key)).toContain("careers");
  });
});
