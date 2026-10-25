import { describe, expect, it } from "vitest";
import type { LandingPoint } from "../../content/types";
import { healthCareLanding } from "./health-care-landing";
import { healthCareOfferDrafts } from "./offers-health-care";

/**
 * The copy rule of the Health & Care pages (Website Build Pack, revision 2, Requirements 1):
 * every point has an icon (`key`), a bold title of up to six words and one supporting line of up
 * to 20 words. `[confirm …]` marks are placeholders for the owner, not copy, so they are not
 * counted. Points the brief gives as a few words with an icon alone (proof chips, systems, the
 * inline "What we need from you" and "Not included" items, card sub-points) have no title.
 */
const words = (text: string): number =>
  text
    .replace(/\[confirm[^\]]*\]/g, "")
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word)).length;

interface Located {
  where: string;
  point: LandingPoint;
}

const located = (where: string, points: readonly LandingPoint[]): Located[] =>
  points.flatMap((point, index) => [
    { where: `${where} #${index + 1}`, point },
    ...located(`${where} #${index + 1} sub-point`, point.points ?? []),
  ]);

const landing = healthCareLanding;
const landingPoints: Located[] = [
  ...located("proof", landing.proof),
  ...[
    landing.audiences,
    landing.painPoints,
    landing.offers,
    landing.automation,
    landing.steps,
    ...landing.guardrails.columns,
    landing.pilots.benefits,
    landing.systems,
    landing.trust,
  ].flatMap((section) => located(section.heading, section.points)),
  ...located("pilots", landing.pilots.products),
  ...located("case studies fallback", [landing.caseStudies.fallback]),
];
const offerPoints: Located[] = healthCareOfferDrafts.flatMap((offer) =>
  (offer.sections ?? []).flatMap((section) =>
    located(`${offer.title} / ${section.heading}`, section.points),
  ),
);
const all = [...landingPoints, ...offerPoints];

describe("Health & Care copy (revision 2)", () => {
  it("gives every point an icon key and a supporting line", () => {
    for (const { where, point } of all) {
      expect(point.key.trim(), where).not.toBe("");
      // A line may be a placeholder alone (Cyber Essentials: "[confirm status …]").
      expect(point.text.trim(), where).not.toBe("");
    }
  });

  it("keeps titles to six words and lines to 20", () => {
    // Copy the brief gives word for word that breaks its own rule: reported to the owner, not
    // rewritten. Remove an entry once the owner shortens it.
    const reported = new Set(["A client asks for chain of custody"]);
    const over = all.flatMap(({ where, point }) => [
      ...(point.title && words(point.title) > 6 && !reported.has(point.title)
        ? [`${where} title: ${point.title}`]
        : []),
      ...(words(point.text) > 20 ? [`${where} line: ${point.text}`] : []),
    ]);
    expect(over).toEqual([]);
  });

  it("gives every card of the page's sections a title (lists of a few words excepted)", () => {
    const untitled = [
      landing.audiences,
      landing.painPoints,
      landing.offers,
      landing.automation,
      landing.steps,
      ...landing.guardrails.columns,
      landing.pilots.benefits,
      landing.trust,
    ].flatMap((section) =>
      section.points.flatMap((point, index) =>
        point.title ? [] : [`${section.heading} #${index + 1}`],
      ),
    );
    expect(untitled).toEqual([]);
  });

  it("gives each offer page its sections and a three-question FAQ", () => {
    for (const offer of healthCareOfferDrafts) {
      expect(
        offer.sections?.map((section) => section.heading),
        offer.title,
      ).toContain("Who this is for");
      expect(offer.sections?.at(-1)?.heading, offer.title).toBe("Not included");
      expect(offer.faq, offer.title).toHaveLength(3);
      expect(offer.outputs.length, offer.title).toBeGreaterThan(0);
    }
  });

  it("never says the AI diagnoses, triages clinically or recommends treatment", () => {
    // The guardrail copy names these only as what the agents never do.
    const never = landing.guardrails.columns[1]?.points.map((point) => point.text) ?? [];
    const affirmative = [
      ...all.map(({ point }) => `${point.title ?? ""} ${point.text}`),
      ...landing.faq.map((entry) => entry.answer),
    ].filter((text) => !never.some((line) => text.includes(line)));
    for (const text of affirmative) {
      expect(text).not.toMatch(/\b(diagnoses|recommends treatment|triages clinically)\b/i);
    }
  });
});
