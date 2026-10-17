import { describe, expect, it } from "vitest";
import { closedGates, evaluateGates } from "@vitalos/cms";
import type { LabAssetSummary, OfferSummary, PracticeSummary, SolutionSummary } from "@vitalos/cms";
import {
  buildFooterModel,
  buildHeaderModel,
  buildIaWhatWeDoColumns,
  buildWhatWeDoColumns,
  buildWhoWeAreColumns,
  colourLogo,
  markLogo,
  whiteLogo,
} from "./nav-model";
import type { ChromeContent } from "./nav-model";
import { activeSectionForPath } from "./section-for-path";
import { withContentSections } from "./load";

const summary = (slug: string, title: string): SolutionSummary => ({ id: slug, slug, title });
const offer = (slug: string, title: string): OfferSummary => ({ id: slug, slug, title });
const lab = (slug: string, labType: LabAssetSummary["labType"]) =>
  ({ id: slug, slug, title: slug, labType, maturity: "concept" }) as LabAssetSummary;

const base: ChromeContent = {
  gates: closedGates,
  settings: {},
  practices: [],
  solutions: [],
  offers: [],
  industries: [],
  labAssets: [],
  trustTopics: [],
  legalPages: [],
};

const social = [
  { label: "LinkedIn", href: "https://www.linkedin.com/company/example" },
  { label: "X", href: "https://x.com/example" },
];

describe("header model", () => {
  it("has the three menus whatever the gates", () => {
    const open = evaluateGates({ industries: 1, work: 2, insights: 6, labs: 1, careers: 1 });
    for (const gates of [closedGates, open]) {
      const { items } = buildHeaderModel({ ...base, gates });
      expect(items.map((item) => item.key)).toEqual(["what-we-do", "who-we-are", "support"]);
    }
  });

  it("links each menu label to its index", () => {
    const { items } = buildHeaderModel(base);
    expect(items.map((item) => item.href)).toEqual(["/what-we-do", "/about", "/contact"]);
  });

  it("lists the company pages under Who We Are, and the industries once their gate opens", () => {
    const industries = [summary("i", "Health & Care"), summary("j", "Growth & Technology")];
    const closed = buildWhoWeAreColumns({ ...base, industries });
    expect(closed.map((c) => c.key)).toEqual(["company"]);
    expect(closed[0]?.links.map((l) => l.label)).toEqual([
      "About",
      "How We Work",
      "All What We Do",
    ]);
    const open = buildWhoWeAreColumns({
      ...base,
      industries,
      gates: evaluateGates({ industries: 1, work: 2, insights: 6, careers: 1 }),
    });
    expect(open[0]?.links.map((l) => l.label)).toEqual([
      "About",
      "How We Work",
      "Work",
      "Insights",
      "All What We Do",
      "Careers",
    ]);
    const column = open.find((c) => c.key === "industries");
    expect(column?.href).toBe("/industries");
    expect(column?.links.map((l) => l.label)).toEqual(["Health & Care", "Growth & Technology"]);
    expect(column?.links.every((l) => l.icon !== undefined)).toBe(true);
    expect(column?.more).toEqual({ label: "All industries", href: "/industries" });
  });

  it("gives What We Do and Who We Are a feature card from locked copy only", () => {
    const { items } = buildHeaderModel({
      ...base,
      practices: [summary("c", "Vitalos Consulting")],
    });
    const whatWeDo = items.find((item) => item.key === "what-we-do")?.menu?.feature;
    expect(whatWeDo?.title).toBe("Modernise. Build. Adopt AI.");
    expect(whatWeDo?.steps).toEqual([
      "Opportunity Assessment",
      "Prototype",
      "Production",
      "Managed AI",
    ]);
    expect(whatWeDo?.links[0]).toEqual({ label: "Talk to Vitalos", href: "/contact" });
    const whoWeAre = items.find((item) => item.key === "who-we-are")?.menu?.feature;
    expect(whoWeAre?.title).toBe(
      "We help ambitious organisations modernise operations, build digital products and adopt AI.",
    );
    expect(whoWeAre?.links[0]).toEqual({ label: "About", href: "/about" });
  });

  it("lists Contact, the FAQ and the enquiry topics under Support", () => {
    const { items } = buildHeaderModel(base);
    const support = items.find((item) => item.key === "support");
    expect(support?.menu?.layout).toBeUndefined();
    expect(support?.menu?.columns[0]?.links).toEqual([
      { key: "contact", label: "Contact", href: "/contact", icon: "mail" },
      { key: "faq", label: "FAQ", href: "/faq", icon: "info" },
    ]);
    const topics = support?.menu?.columns[1];
    expect(topics?.href).toBe("/contact");
    expect(topics?.links.map((l) => l.href)).toEqual([
      "/contact?intent=project",
      "/contact?intent=engineering",
      "/contact?intent=ai",
      "/contact?intent=managed-services",
      "/contact?intent=procurement",
      "/contact?intent=partnership",
    ]);
    expect(topics?.links[0]?.label).toBe("A new project");
    expect(items.find((item) => item.key === "who-we-are")?.menu?.layout).toBeUndefined();
  });

  it("has no Trust Centre link and keeps the Talk to Vitalos action to /contact", () => {
    const model = buildHeaderModel(base);
    expect(JSON.stringify(model)).not.toContain("/trust");
    expect(model.cta).toEqual({ label: "Talk to Vitalos", href: "/contact" });
  });

  it("carries the social profiles from settings for the compact menu", () => {
    expect(buildHeaderModel(base).social).toBeUndefined();
    expect(buildHeaderModel({ ...base, settings: { social } }).social).toEqual(social);
  });

  it("puts the colour lockup in the header unless site settings carry a logo", () => {
    expect(buildHeaderModel(base).logo).toEqual(colourLogo);
    expect(buildHeaderModel(base).logoOnDark).toEqual(whiteLogo);
    expect(buildHeaderModel(base).compactLogo).toEqual(markLogo);
    const logo = { src: "/images/logo.svg", width: 10, height: 10 };
    expect(buildHeaderModel({ ...base, settings: { logo } }).logo).toEqual(logo);
  });

  it("puts the white monochrome lockup in the footer", () => {
    expect(buildFooterModel(base).brand?.logo).toEqual(whiteLogo);
  });
});

describe("What We Do mega-menu", () => {
  const practice = (title: string): PracticeSummary =>
    summary(title.toLowerCase().replace(/\W+/g, "-"), title);

  it("orders practices and solutions as the specs fix them, not alphabetically", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      practices: [
        practice("Vitalos Managed Services"),
        practice("Vitalos AI & Data"),
        practice("Vitalos Consulting"),
      ],
      solutions: [summary("a", "Application Modernisation"), summary("b", "AI Transformation")],
    });
    expect(columns.find((c) => c.key === "practices")?.links.map((l) => l.label)).toEqual([
      "Vitalos Consulting",
      "Vitalos AI & Data",
      "Vitalos Managed Services",
    ]);
    expect(columns.find((c) => c.key === "solutions")?.links.map((l) => l.label)).toEqual([
      "AI Transformation",
      "Application Modernisation",
    ]);
  });

  it("has no Popular offers column (owner direction, 15 Oct 2026)", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      offers: [offer("b", "AI Opportunity Assessment")],
    });
    expect(columns.map((c) => c.key)).not.toContain("popular-offers");
  });

  it("adds Labs, with the lab types that have assets, only once the Labs gate is open", () => {
    const labAssets = [lab("x", "demonstrators"), lab("y", "research"), lab("z", "research")];
    expect(buildWhatWeDoColumns({ ...base, labAssets }).map((c) => c.key)).not.toContain("labs");
    const columns = buildWhatWeDoColumns({
      ...base,
      labAssets,
      gates: evaluateGates({ labs: 1 }),
    });
    const labs = columns.find((c) => c.key === "labs");
    expect(labs?.href).toBe("/labs");
    expect(labs?.links.map((l) => l.href)).toEqual(["/labs/research", "/labs/demonstrators"]);
  });

  it("gives practices their icon (no summary), and closes every column with its index", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      practices: [{ ...summary("c", "Vitalos Consulting"), summary: "Example summary (fixture)." }],
      solutions: [summary("s", "AI Transformation")],
    });
    const practices = columns.find((c) => c.key === "practices");
    expect(practices?.links[0]).toEqual({
      label: "Vitalos Consulting",
      href: "/what-we-do/c",
      icon: "compass",
    });
    expect(practices?.more).toEqual({ label: "All What We Do", href: "/what-we-do" });
    expect(columns.find((c) => c.key === "solutions")?.more).toEqual({
      label: "All solutions",
      href: "/solutions",
    });
  });

  it("omits empty columns and has no Explore column", () => {
    expect(buildWhatWeDoColumns(base)).toEqual([]);
  });

  it("links each column heading to its index", () => {
    const columns = buildWhatWeDoColumns({
      ...base,
      practices: [summary("p", "Vitalos Consulting")],
      solutions: [summary("s", "AI Transformation")],
      offers: [offer("o", "AI Opportunity Assessment")],
    });
    expect(columns.map((c) => c.href)).toEqual(["/what-we-do", "/solutions"]);
  });
});

describe("six practices (owner decision 1, 17 Oct 2026)", () => {
  const practices = [
    summary("consulting", "Vitalos Consulting"),
    summary("engineering", "Vitalos Engineering"),
    summary("ai-data", "Vitalos AI & Data"),
    summary("experience", "Vitalos Experience"),
    summary("managed-services", "Vitalos Managed Services"),
  ];

  it("lists Vitalos Labs as the sixth practice in the menu and the footer, linking to /labs", () => {
    const content = { ...base, practices, gates: evaluateGates({ labs: 1 }) };
    const menu = buildWhatWeDoColumns(content).find((c) => c.key === "practices");
    expect(menu?.links).toHaveLength(6);
    expect(menu?.links[5]).toEqual({ label: "Vitalos Labs", href: "/labs", icon: "flask" });
    const footer = buildFooterModel(content).columns.find((c) => c.key === "what-we-do");
    expect(footer?.links.map((l) => l.label)).toEqual([
      "Vitalos Consulting",
      "Vitalos Engineering",
      "Vitalos AI & Data",
      "Vitalos Experience",
      "Vitalos Managed Services",
      "Vitalos Labs",
    ]);
    // Labs is listed once in the footer, as a practice, not again under Explore.
    const all = buildFooterModel(content).columns.flatMap((c) => c.links.map((l) => l.href));
    expect(all.filter((href) => href === "/labs")).toHaveLength(1);
  });

  it("leaves Labs out while its gate is closed, so nothing links to a 404", () => {
    const menu = buildWhatWeDoColumns({ ...base, practices }).find((c) => c.key === "practices");
    expect(menu?.links.map((l) => l.href)).not.toContain("/labs");
  });
});

describe("header model, ia variant (ADR-045)", () => {
  const open = evaluateGates({ industries: 1, labs: 1 });
  const content: ChromeContent = {
    ...base,
    navVariant: "ia",
    gates: open,
    practices: [summary("consulting", "Vitalos Consulting")],
    solutions: [summary("ai-transformation", "AI Transformation")],
    offers: [
      offer("ai-opportunity-assessment", "AI Opportunity Assessment"),
      offer("systems-integration", "Systems Integration"),
    ],
    industries: [summary("health-care", "Health & Care")],
    labAssets: [lab("a", "research")],
  };

  it("shows What We Do, Industries, Labs (in the Work slot) and About while Work and Insights are closed", () => {
    const header = buildHeaderModel(content);
    expect(header.navVariant).toBe("ia");
    expect(header.items.map((i) => [i.key, i.label, i.href])).toEqual([
      ["what-we-do", "What We Do", "/what-we-do"],
      ["industries", "Industries", "/industries"],
      ["labs", "Labs", "/labs"],
      ["about", "About", "/about"],
    ]);
    // Never a link to the closed Work section, and Labs only once.
    expect(header.items.map((i) => i.href)).not.toContain("/work");
  });

  it("shows Work and Insights once their gates open, and Labs after them", () => {
    const all = evaluateGates({ industries: 1, work: 2, insights: 6, labs: 1 });
    const header = buildHeaderModel({ ...content, gates: all });
    expect(header.items.map((i) => i.key)).toEqual([
      "what-we-do",
      "industries",
      "work",
      "insights",
      "labs",
      "about",
    ]);
  });

  it("drops Industries and Labs while their gates are closed", () => {
    const header = buildHeaderModel({ ...content, gates: closedGates });
    expect(header.items.map((i) => i.key)).toEqual(["what-we-do", "about"]);
  });

  it("has the Trust Centre and Contact as utility links and the same primary action", () => {
    const header = buildHeaderModel(content);
    expect(header.utility).toEqual([
      { key: "trust", label: "Trust Centre", href: "/trust" },
      { key: "contact", label: "Contact", href: "/contact" },
    ]);
    expect(header.cta).toEqual({ label: "Talk to Vitalos", href: "/contact" });
  });

  it("opens a What We Do mega-menu with Practices, Solutions, Offers, Industries and Labs", () => {
    const columns = buildIaWhatWeDoColumns(content);
    expect(columns.map((c) => c.key)).toEqual([
      "practices",
      "solutions",
      "offers",
      "industries",
      "labs",
    ]);
    const offers = columns.find((c) => c.key === "offers");
    // Priority offers only, closed by the offers index.
    expect(offers?.links.map((l) => l.label)).toEqual(["AI Opportunity Assessment"]);
    expect(offers?.more).toEqual({ label: "All offers", href: "/offers" });
    const header = buildHeaderModel(content);
    expect(header.items[0]?.menu?.columns).toEqual(columns);
    expect(header.items[0]?.menu?.feature).toBeUndefined();
    // Only What We Do has a menu.
    expect(header.items.slice(1).every((item) => item.menu === undefined)).toBe(true);
  });

  it("leaves the current variant unchanged when the variant is omitted or current", () => {
    const withoutVariant: ChromeContent = { ...content };
    delete withoutVariant.navVariant;
    const omitted = buildHeaderModel(withoutVariant);
    const current = buildHeaderModel({ ...content, navVariant: "current" });
    expect(current).toEqual(omitted);
    expect(current.navVariant).toBe("current");
    expect(current.items.map((i) => i.key)).toEqual(["what-we-do", "who-we-are", "support"]);
    expect(current.utility).toBeUndefined();
  });
});

describe("footer model", () => {
  it("has no gated link and no empty column while everything is closed and empty", () => {
    const { columns, legalIdentity } = buildFooterModel(base);
    const hrefs = columns.flatMap((column) => column.links.map((link) => link.href));
    for (const gated of ["/industries", "/work", "/insights", "/labs", "/careers"]) {
      expect(hrefs).not.toContain(gated);
    }
    expect(columns.every((column) => column.links.length > 0)).toBe(true);
    expect(legalIdentity).toBeUndefined();
  });

  it("lists Careers only once there is an open role", () => {
    const closed = buildFooterModel(base).columns.flatMap((c) => c.links.map((l) => l.href));
    const open = buildFooterModel({
      ...base,
      gates: evaluateGates({ careers: 1 }),
    }).columns.flatMap((c) => c.links.map((l) => l.href));
    expect(closed).not.toContain("/careers");
    expect(open).toContain("/careers");
  });

  it("links Contact and the FAQ under Company, and never the removed Leadership page", () => {
    const { columns } = buildFooterModel(base);
    const company = columns.find((c) => c.key === "company")?.links.map((l) => l.href);
    expect(company).toEqual(["/about", "/contact", "/faq"]);
    expect(JSON.stringify(columns)).not.toContain("leadership");
  });

  it("takes the legal identity from site settings only, line by line, without the address", () => {
    const { legalIdentity } = buildFooterModel({
      ...base,
      settings: { legalName: "Example Ltd", companyNumber: "123", registeredAddress: "1 Street" },
    });
    const year = new Date().getFullYear();
    expect(legalIdentity?.lines).toEqual([`© ${year} Example Ltd`, "Company number 123"]);
    const partial = buildFooterModel({ ...base, settings: { legalName: "Example Ltd" } });
    expect(partial.legalIdentity?.lines).toEqual([`© ${year} Example Ltd`]);
  });

  it("puts the social profiles under the logo and no longer repeats the contact email", () => {
    const model = buildFooterModel({
      ...base,
      settings: { contactEmail: "hello@example.invalid", social },
    });
    expect(model.brand?.social).toEqual(social);
    expect(JSON.stringify(model)).not.toContain("hello@example.invalid");
  });

  it("builds the trust column from published summaries", () => {
    const { columns } = buildFooterModel({
      ...base,
      trustTopics: [{ id: "t", topic: "security", title: "Security" }],
    });
    expect(columns.find((c) => c.key === "trust")?.links.map((l) => l.href)).toEqual([
      "/trust",
      "/trust/security",
    ]);
    expect(columns.find((c) => c.key === "legal")).toBeUndefined();
  });

  it("puts legal pages that exist, then the sitemap, in the bottom-row legal links", () => {
    expect(buildFooterModel(base).legalLinks).toEqual([{ label: "Sitemap", href: "/sitemap.xml" }]);
    const { legalLinks } = buildFooterModel({
      ...base,
      legalPages: [{ id: "l", slug: "privacy", title: "Privacy notice" }],
    });
    expect(legalLinks).toEqual([
      { label: "Privacy notice", href: "/legal/privacy" },
      { label: "Sitemap", href: "/sitemap.xml" },
    ]);
  });

  it("has no podcast block while PODCAST_ENABLED is off, even with valid URLs (decision 3)", () => {
    const urls = {
      spotifyUrl: "https://open.spotify.com/show/example-fixture",
      appleUrl: "https://podcasts.apple.com/gb/podcast/example-fixture",
    };
    expect(buildFooterModel({ ...base, settings: { podcast: urls } }).podcast).toBeUndefined();
    expect(
      buildFooterModel({ ...base, podcastEnabled: false, settings: { podcast: urls } }).podcast,
    ).toBeUndefined();
  });

  it("has no podcast block without valid URLs, and drops invalid ones", () => {
    expect(buildFooterModel({ ...base, podcastEnabled: true }).podcast).toBeUndefined();
    const invalid = buildFooterModel({
      ...base,
      podcastEnabled: true,
      settings: {
        podcast: {
          spotifyUrl: "https://example.invalid/show",
          appleUrl: "http://podcasts.apple.com/x",
        },
      },
    });
    expect(invalid.podcast).toBeUndefined();
  });

  it("renders each podcast link only when its URL is set", () => {
    const spotifyOnly = buildFooterModel({
      ...base,
      podcastEnabled: true,
      settings: { podcast: { spotifyUrl: "https://open.spotify.com/show/example-fixture" } },
    }).podcast;
    expect(spotifyOnly?.heading).toBe("Podcast");
    expect(spotifyOnly?.intro).toBeUndefined();
    expect(spotifyOnly?.links).toEqual([
      {
        platform: "spotify",
        label: "Spotify",
        accessibleName: "Listen on Spotify",
        href: "/podcast", // the footer leads to the podcast page, which opens the app
      },
    ]);
    const both = buildFooterModel({
      ...base,
      podcastEnabled: true,
      settings: {
        podcast: {
          spotifyUrl: "https://open.spotify.com/show/example-fixture",
          appleUrl: "https://podcasts.apple.com/gb/podcast/example-fixture",
        },
      },
    }).podcast;
    expect(both?.links.map((l) => l.accessibleName)).toEqual([
      "Listen on Spotify",
      "Listen on Apple Podcasts",
    ]);
  });
});

describe("activeSectionForPath", () => {
  it("maps the commercial layers and Labs to What We Do", () => {
    for (const path of [
      "/what-we-do",
      "/what-we-do/consulting",
      "/solutions",
      "/solutions/x",
      "/offers/y",
      "/labs/research/x",
    ]) {
      expect(activeSectionForPath(path), path).toBe("what-we-do");
    }
  });

  it("maps About, How We Work, Industries, Work and Insights to Who We Are", () => {
    for (const path of ["/about", "/how-we-work", "/industries/x", "/work", "/insights/x"]) {
      expect(activeSectionForPath(path), path).toBe("who-we-are");
    }
  });

  it("maps Contact and the FAQ to Support", () => {
    expect(activeSectionForPath("/contact")).toBe("support");
    expect(activeSectionForPath("/faq")).toBe("support");
  });

  it("has no active section elsewhere, and respects path boundaries", () => {
    expect(activeSectionForPath("/")).toBeUndefined();
    expect(activeSectionForPath("/trust")).toBeUndefined();
    expect(activeSectionForPath("/worksheets")).toBeUndefined();
    expect(activeSectionForPath("/what-we-do/")).toBe("what-we-do");
    expect(activeSectionForPath(null)).toBeUndefined();
  });
});

describe("activeSectionForPath, ia variant", () => {
  it("marks each top-level IA item", () => {
    expect(activeSectionForPath("/solutions/x", "ia")).toBe("what-we-do");
    expect(activeSectionForPath("/offers", "ia")).toBe("what-we-do");
    expect(activeSectionForPath("/industries/health-care", "ia")).toBe("industries");
    expect(activeSectionForPath("/labs/research/x", "ia")).toBe("labs");
    expect(activeSectionForPath("/insights", "ia")).toBe("insights");
    expect(activeSectionForPath("/how-we-work", "ia")).toBe("about");
    expect(activeSectionForPath("/contact", "ia")).toBeUndefined();
  });

  it("defaults to the current variant", () => {
    expect(activeSectionForPath("/labs")).toBe("what-we-do");
    expect(activeSectionForPath("/contact")).toBe("support");
  });
});

describe("Insights and Careers in the chrome follow the admin's site state", () => {
  it("opens or closes only the Insights and Careers gates", () => {
    const gates = evaluateGates({ work: 3, insights: 0, labs: 2, industries: 2, careers: 1 });
    const open = withContentSections(gates, { insightsOpen: true, careersOpen: true });
    expect(open.open.insights).toBe(true);
    expect(open.open.careers).toBe(true);
    const closed = withContentSections(
      { ...gates, open: { ...gates.open, insights: true, careers: true } },
      { insightsOpen: false, careersOpen: false },
    );
    expect(closed.open.insights).toBe(false);
    expect(closed.open.careers).toBe(false);
    expect(closed.open.work).toBe(gates.open.work);
  });
});
