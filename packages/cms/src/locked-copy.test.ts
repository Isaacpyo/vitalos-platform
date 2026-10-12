import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  aiJourneyStages,
  brandLine,
  ctas,
  descriptor,
  homeSections,
  howWeWorkStages,
  industryNames,
  offerNames,
  practiceDisplayName,
  practiceNames,
  priorityOfferNames,
  proposition,
  solutionNames,
} from "./locked-copy";

describe("locked copy (verbatim from the specs)", () => {
  it("holds the descriptor, proposition and brand line", () => {
    expect(descriptor).toBe("Technology Consulting, Engineering & Digital Transformation");
    expect(proposition).toBe(
      "We help ambitious organisations modernise operations, build digital products and adopt AI.",
    );
    expect(brandLine).toBe("From strategy to production.");
    expect(ctas).toEqual({ primary: "Talk to Vitalos", secondary: "Explore what we do" });
  });

  it("has five practices and does not treat Labs as one", () => {
    expect(practiceNames).toHaveLength(5);
    expect(practiceNames as readonly string[]).not.toContain("Labs");
    expect(practiceDisplayName("AI & Data")).toBe("Vitalos AI & Data");
  });

  it("has the five solutions, twelve offers (six priority) and four industries", () => {
    expect(solutionNames).toHaveLength(5);
    expect(offerNames).toHaveLength(12);
    expect(priorityOfferNames).toHaveLength(6);
    for (const name of priorityOfferNames) expect(offerNames as readonly string[]).toContain(name);
    expect(industryNames).toHaveLength(4);
  });

  it("orders the AI journey, How We Work stages and homepage sections", () => {
    expect(aiJourneyStages).toEqual([
      "Opportunity Assessment",
      "Prototype",
      "Production",
      "Managed AI",
    ]);
    expect(howWeWorkStages).toHaveLength(9);
    expect(howWeWorkStages[0]).toBe("Qualify");
    expect(howWeWorkStages[8]).toBe("Improve");
    expect(homeSections).toHaveLength(13);
    expect(homeSections[0]?.key).toBe("hero");
  });

  it("separates structural labels from spec-quoted visitor headings", () => {
    const withHeading = homeSections.filter((section) => "visibleHeading" in section);
    expect(withHeading.map((section) => section.key)).toEqual([
      "problems",
      "strategyToProduction",
      "practices",
      "aiAtTheCentre",
      "selectedWork",
      "finalConversion",
    ]);
    for (const section of homeSections) expect(section.structuralLabel.length).toBeGreaterThan(0);
  });
});

describe("@vitalos/cms public entry stays framework-free", () => {
  const root = fileURLToPath(new URL(".", import.meta.url));
  const publicEntryFiles = [
    "index.ts",
    "routes.ts",
    "navigation.ts",
    "locked-copy.ts",
    ...readdirSync(join(root, "content"))
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
      .map((file) => join("content", file)),
  ];

  it.each(publicEntryFiles)("%s imports no CMS SDK and no next", (file) => {
    const path = join(root, file);
    expect(statSync(path).isFile()).toBe(true);
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/from\s+["'](next|@sanity)[/"']/);
  });
});
