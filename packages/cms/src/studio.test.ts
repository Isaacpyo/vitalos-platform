import { describe, expect, it } from "vitest";
import { apiRoutes, routeManifest } from "./routes";
import {
  awaitingApprovalFilter,
  deskGroups,
  needsReviewFilter,
  singletonTitles,
} from "./structure";
import { documentTypeNames, singletonTypes } from "./schemaTypes/constants";
import {
  defaultPreviewOrigin,
  locationFor,
  locationTypes,
  locations,
  mainDocuments,
  manifestPatterns,
  previewUrlOption,
  resolvedPatterns,
  toPresentationRoute,
} from "./presentation";

describe("desk structure", () => {
  it("places every non-singleton document type in exactly one group", () => {
    const grouped = deskGroups.flatMap((group) => group.types);
    expect(new Set(grouped).size).toBe(grouped.length);
    const expected = documentTypeNames.filter(
      (type) => !(singletonTypes as readonly string[]).includes(type),
    );
    expect([...grouped].sort()).toEqual([...expected].sort());
  });

  it("pins both singletons with titles", () => {
    expect(Object.keys(singletonTitles).sort()).toEqual([...singletonTypes].sort());
  });

  it("filters the governance queues on governance fields", () => {
    expect(needsReviewFilter).toContain("governance.reviewDate < $today");
    expect(needsReviewFilter).toContain('governance.editorialStatus != "archived"');
    expect(awaitingApprovalFilter).toContain('governance.editorialStatus == "review"');
  });
});

describe("presentation (visual editing)", () => {
  it("only maps detail routes that exist in the route manifest", () => {
    for (const pattern of resolvedPatterns) expect(manifestPatterns).toContain(pattern);
  });

  it("converts Next.js patterns to Presentation route syntax", () => {
    expect(toPresentationRoute("/labs/[type]/[slug]")).toBe("/labs/:type/:slug");
    expect(toPresentationRoute("/what-we-do")).toBe("/what-we-do");
  });

  it("resolves a main document for every routed page", () => {
    const routes = (mainDocuments as { route: string | string[] }[]).map((entry) =>
      Array.isArray(entry.route) ? entry.route.join(",") : entry.route,
    );
    for (const entry of routeManifest) {
      expect(routes, entry.pattern).toContain(toPresentationRoute(entry.pattern));
    }
  });

  it("derives locations from routes.ts", () => {
    expect(
      locationFor("practice", { title: "Example Practice (fixture)", slug: "example-practice" }),
    ).toEqual({
      locations: [{ title: "Example Practice (fixture)", href: "/what-we-do/example-practice" }],
    });
    expect(
      locationFor("labAsset", { title: "Example", slug: "x", labType: "demonstrators" }),
    ).toEqual({
      locations: [{ title: "Example", href: "/labs/demonstrators/x" }],
    });
    expect(
      locationFor("trustItem", { title: "Security", topic: "security" })?.locations[0]?.href,
    ).toBe("/trust/security");
    expect(
      locationFor("legalPage", { title: "Privacy", slug: "privacy" })?.locations[0]?.href,
    ).toBe("/legal/privacy");
    expect(
      locationFor("routePage", { heading: "Contact", routeKey: "contact" })?.locations[0]?.href,
    ).toBe("/contact");
    expect(locationFor("homePage", { title: "Homepage" })?.locations[0]?.href).toBe("/");
  });

  it("returns no location for documents without a valid route yet", () => {
    expect(locationFor("practice", { title: "No slug" })).toBeNull();
    expect(locationFor("practice", { title: "Bad", slug: "Not A Slug" })).toBeNull();
    expect(locationFor("labAsset", { title: "No type", slug: "x" })).toBeNull();
    expect(locationFor("practice", null)).toBeNull();
  });

  it("registers a location resolver for every routable type", () => {
    expect(Object.keys(locations).sort()).toEqual([...locationTypes].sort());
  });

  it("points preview mode at the draft-mode route and defaults to the local web app", () => {
    expect(previewUrlOption(undefined)).toEqual({
      initial: defaultPreviewOrigin,
      previewMode: { enable: apiRoutes.draftModeEnable, disable: apiRoutes.draftModeDisable },
    });
    expect(previewUrlOption("https://preview.example.invalid").initial).toBe(
      "https://preview.example.invalid",
    );
  });
});
