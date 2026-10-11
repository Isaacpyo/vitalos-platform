import { describe, expect, it } from "vitest";
import { evaluateGates } from "@vitalos/cms";
import type { PersonView } from "@vitalos/cms";
import { fullFixtureSet } from "@vitalos/cms/fixtures";
import { aboutLinks, leaderCardProps, leadershipOf } from "./map";

const people = fullFixtureSet.documents.person as PersonView[];

describe("about mapping", () => {
  it("selects leadership profiles only", () => {
    expect(leadershipOf(people).map((p) => p.slug)).toEqual(["example-person"]);
    expect(leadershipOf([])).toEqual([]);
  });

  it("links leaders to their profile pages", () => {
    expect(leaderCardProps(people[0]!)).toMatchObject({ href: "/people/example-person" });
  });

  it("links to Careers only while its section is public", () => {
    expect(aboutLinks(evaluateGates({})).map((l) => l.key)).toEqual(["how-we-work", "trust"]);
    expect(aboutLinks(evaluateGates({ careers: 1 })).map((l) => l.key)).toContain("careers");
  });
});
