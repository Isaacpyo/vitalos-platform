import { describe, expect, it } from "vitest";
import { heroArtwork, heroToneForPath } from "./hero-artwork";
import { industryArtworkFor } from "./industry-artwork";
import { practiceArtworkFor } from "./practice-artwork";
import { solutionDiagramFor } from "./solution-diagrams";
import { stageIconFor } from "./stage-icons";
import { iconFor } from "./icons";

describe("hero tone by route (ADR-044)", () => {
  it("keeps the dark hero on top-level and family pages", () => {
    for (const path of [
      "/",
      "/what-we-do",
      "/what-we-do/consulting",
      "/solutions/ai-transformation",
      "/offers",
      "/industries/health-care",
      "/about",
      "/how-we-work",
      "/insights",
      "/insights/topics/strategy",
      "/careers",
      "/trust",
      "/contact",
      "/labs/frameworks/example",
      undefined,
    ]) {
      expect(heroToneForPath(path), String(path)).toBe("dark");
    }
  });

  it("uses the light compact hero on reading pages", () => {
    for (const path of [
      "/offers/ai-opportunity-assessment",
      "/insights/introducing-vitalos",
      "/careers/senior-technology-consultant/",
      "/legal/privacy",
      "/trust/security",
    ]) {
      expect(heroToneForPath(path), path).toBe("light");
    }
    expect(heroToneForPath("/insights/feed.xml")).toBe("dark");
  });
});

describe("artwork, diagram and icon mappings", () => {
  it("gives every practice and industry its own variant, and Labs its own family", () => {
    expect(practiceArtworkFor("Vitalos Consulting")).toEqual({
      family: "what-we-do",
      seed: "consulting",
    });
    expect(practiceArtworkFor("Labs").family).toBe("labs");
    expect(industryArtworkFor("Health & Care")).toEqual({
      family: "industries",
      seed: "health-care",
    });
    expect(heroArtwork("home")).toEqual({ family: "home" });
  });

  it("draws AI Transformation as the AI journey, never a chip", () => {
    expect(solutionDiagramFor("AI Transformation")).toBe("ai-journey");
    expect(iconFor("solution", "AI Transformation")).not.toBe("chip");
    expect(iconFor("practice", "AI & Data")).not.toBe("chip");
  });

  it("has a line icon for each of the nine stages", () => {
    for (const stage of [
      "Qualify",
      "Discover",
      "Define",
      "Design",
      "Engineer",
      "Validate",
      "Release",
      "Operate",
      "Improve",
    ]) {
      expect(stageIconFor(stage), stage).toBeDefined();
    }
  });
});
