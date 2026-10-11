/**
 * Static checks on the GROQ text. Evaluating GROQ needs a dataset; these assert the public-safety
 * rules are present and the forbidden fields are absent. `sanity typegen` (check:cms-types) also
 * parses every query against the schema.
 */
import { describe, expect, it } from "vitest";
import * as all from "./index";
import { detailQueries, summariesQueries } from "./registry";
import { docKinds } from "../content/testing/contract";

const queries: [string, string][] = (Object.entries(all) as [string, unknown][]).flatMap(
  ([name, value]) => (name.endsWith("Query") && typeof value === "string" ? [[name, value]] : []),
);

describe("query set", () => {
  it("has a detail and a summaries query for every document kind", () => {
    for (const kind of docKinds) {
      expect(detailQueries[kind]).toEqual(expect.any(String));
      expect(summariesQueries[kind]).toEqual(expect.any(String));
    }
    expect(queries.length).toBe(27);
  });

  it.each(queries)(
    "%s never projects evidence pointers, owners or permission evidence",
    (_name, query) => {
      expect(query).not.toMatch(/evidenceReference|evidenceOwner/);
      // Only the computed "is permission verified" check may read permissionEvidence.
      for (const match of query.matchAll(/permissionEvidence(?!\.evidenceStatus ==)/g)) {
        throw new Error(
          `permissionEvidence is projected: ...${query.slice(match.index, match.index + 40)}`,
        );
      }
    },
  );

  it.each(queries)("%s never spreads a whole document", (_name, query) => {
    // Spreads are allowed only inside rich text blocks (after a `_type ==` condition or `[]{`).
    expect(query).not.toMatch(/\]\[0\]\{\s*\.\.\./);
    expect(query).not.toMatch(/\|\s*order\([^)]*\)\{\s*\.\.\./);
  });

  it.each(queries)("%s filters on editorial status", (_name, query) => {
    expect(query).toContain("governance.editorialStatus in $statuses");
  });

  it("requires explicitly public evidence for evidence-bearing documents", () => {
    for (const kind of ["caseStudy", "labAsset", "trustItem"] as const) {
      expect(detailQueries[kind]).toContain('evidence.classification == "public"');
      expect(summariesQueries[kind]).toContain('evidence.classification == "public"');
    }
    expect(all.gateCountsQuery).toContain('evidence.classification == "public"');
    expect(all.sitemapQuery).toContain('evidence.classification == "public"');
    expect(all.homePageQuery).toContain('evidence.classification == "public"');
  });

  it("never reads classification as 'not controlled' (unclassified must stay hidden)", () => {
    for (const [, query] of queries) expect(query).not.toContain('!= "controlled"');
  });

  it("applies the rights, permission, verification and maintenance rules", () => {
    expect(all.caseStudyQuery).toContain('testimonial.permissionStatus == "granted"');
    expect(all.caseStudyQuery).toContain('evidence.evidenceStatus == "verified"');
    expect(all.labAssetQuery).toContain("maintained == true");
    expect(all.personQuery).toContain("verified == true");
    expect(all.personQuery).toContain('portrait.rightsStatus == "approved"');
    expect(all.siteSettingsQuery).toContain("verified == true");
    expect(all.siteSettingsQuery).toContain('logo.rightsStatus == "approved"');
    expect(all.trustItemQuery).toContain("expiresAt >= $today");
    expect(all.trustItemQuery).toContain('evidence.evidenceStatus == "verified"');
    // The sitemap projects what the shared isJobOpenOn rule needs to drop closed or expired roles.
    expect(all.sitemapQuery).toMatch(/"job": \*\[_type == "job"[^\n]*status, validThrough/);
    expect(all.gateCountsQuery).toContain('status == "open"');
    expect(all.gateCountsQuery).toContain("validThrough >= $today");
    expect(all.gateCountsQuery).toContain('evidence.evidenceStatus == "verified"');
  });

  it("restricts every image projection to approved rights", () => {
    for (const [name, query] of queries) {
      const images = query.match(/asset->url/g)?.length ?? 0;
      const guards = query.match(/rightsStatus == "approved" =>/g)?.length ?? 0;
      expect(guards, name).toBeGreaterThanOrEqual(images > 0 ? 1 : 0);
      // Every image projection sits inside a guard: counts line up per query.
      expect(images, name).toBeLessThanOrEqual(guards);
    }
  });

  it("reads weak relations in both directions", () => {
    expect(all.practiceQuery).toContain("^._id in practices[]._ref");
    expect(all.solutionQuery).toContain("^._id in solutions[]._ref");
    expect(all.offerQuery).toContain("^._id in offers[]._ref");
    expect(all.caseStudyQuery).toContain("^._id in work[]._ref");
    expect(all.personQuery).toContain("^._id in authors[]._ref");
  });
});
