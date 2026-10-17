/**
 * Route manifest for the quality suites (ADR-021). One entry per page TEMPLATE, using the
 * artificial fixture slugs from packages/cms/src/fixtures. Insights and Careers pages come from the
 * Super Admin (ADR-039) and are swept by tests/content against a fake admin. `pattern` is the route family as it
 * appears in sitemap.xml, so a suite can prove that the manifest has not drifted from the site: a
 * new template appears in the sitemap, matches no pattern and fails `sitemap.http.spec.ts` until it
 * is added here (and therefore to the axe, reflow, focus and JavaScript-budget sweeps).
 * Under the draft content source the sweeps use `DRAFT_TEMPLATES` instead (ADR-025).
 */
import { isDraftRun } from "./content-source";

export interface TemplateRoute {
  /** Stable name used in test titles. */
  name: string;
  /** A representative URL in the `full` fixture set. */
  path: string;
  /** Route family: `:slug` matches exactly one path segment. */
  pattern: string;
  /**
   * False for a template the sitemap does not list by design: the sitemap enumerates documents,
   * and lab category pages are navigation pages linked from the Labs index.
   */
  inSitemap?: false;
}

export const FIXTURE_TEMPLATES: readonly TemplateRoute[] = [
  { name: "home", path: "/", pattern: "/" },
  { name: "what we do", path: "/what-we-do", pattern: "/what-we-do" },
  { name: "practice", path: "/what-we-do/example-practice", pattern: "/what-we-do/:slug" },
  { name: "solutions", path: "/solutions", pattern: "/solutions" },
  { name: "solution", path: "/solutions/example-solution", pattern: "/solutions/:slug" },
  { name: "offers", path: "/offers", pattern: "/offers" },
  { name: "offer", path: "/offers/example-offer", pattern: "/offers/:slug" },
  { name: "industries", path: "/industries", pattern: "/industries" },
  { name: "industry", path: "/industries/example-industry", pattern: "/industries/:slug" },
  { name: "how we work", path: "/how-we-work", pattern: "/how-we-work" },
  { name: "work index", path: "/work", pattern: "/work" },
  { name: "case study", path: "/work/example-case-study", pattern: "/work/:slug" },
  { name: "person", path: "/people/example-person", pattern: "/people/:slug" },
  { name: "labs index", path: "/labs", pattern: "/labs" },
  { name: "labs category", path: "/labs/open-source", pattern: "/labs/:slug" },
  {
    name: "lab asset",
    path: "/labs/open-source/example-open-source-tool",
    pattern: "/labs/:slug/:slug",
  },
  { name: "about", path: "/about", pattern: "/about" },
  { name: "faq", path: "/faq", pattern: "/faq" },
  { name: "trust overview", path: "/trust", pattern: "/trust" },
  { name: "trust topic", path: "/trust/security", pattern: "/trust/:slug" },
  { name: "legal", path: "/legal/privacy", pattern: "/legal/:slug" },
  { name: "contact", path: "/contact", pattern: "/contact" },
  // Served but noindex while the show links are placeholders (owner direction, 16 Oct 2026), and
  // only while PODCAST_ENABLED is on (owner decision 3, ADR-045): otherwise it is a 404.
  ...(process.env.PODCAST_ENABLED === "true"
    ? [{ name: "podcast", path: "/podcast", pattern: "/podcast", inSitemap: false }]
    : []),
];

/**
 * The same templates under the `draft` content source (ADR-025), with draft slugs. Work, Insights,
 * people, Leadership and Careers are open only because of the invented placeholder documents
 * (ADR-025 status note, 11 October 2026): their pages are served but always `noindex`, so the
 * sitemap omits them, as it does the legal pages (marked "not in force").
 */
const DRAFT_TEMPLATES: readonly TemplateRoute[] = [
  { name: "home", path: "/", pattern: "/" },
  { name: "what we do", path: "/what-we-do", pattern: "/what-we-do" },
  { name: "practice", path: "/what-we-do/engineering", pattern: "/what-we-do/:slug" },
  { name: "solutions", path: "/solutions", pattern: "/solutions" },
  { name: "solution", path: "/solutions/ai-transformation", pattern: "/solutions/:slug" },
  { name: "offers", path: "/offers", pattern: "/offers" },
  { name: "offer", path: "/offers/ai-opportunity-assessment", pattern: "/offers/:slug" },
  { name: "industries", path: "/industries", pattern: "/industries" },
  { name: "industry", path: "/industries/health-care", pattern: "/industries/:slug" },
  { name: "how we work", path: "/how-we-work", pattern: "/how-we-work" },
  { name: "work index", path: "/work", pattern: "/work", inSitemap: false },
  {
    name: "case study",
    path: "/work/connecting-field-and-warehouse-systems",
    pattern: "/work/:slug",
    inSitemap: false,
  },
  { name: "person", path: "/people/alex-morgan", pattern: "/people/:slug", inSitemap: false },
  { name: "labs index", path: "/labs", pattern: "/labs" },
  { name: "labs category", path: "/labs/research", pattern: "/labs/:slug" },
  {
    name: "lab asset",
    path: "/labs/research/production-ai-evaluation-harness",
    pattern: "/labs/:slug/:slug",
  },
  { name: "about", path: "/about", pattern: "/about" },
  { name: "faq", path: "/faq", pattern: "/faq" },
  { name: "trust overview", path: "/trust", pattern: "/trust" },
  { name: "trust topic", path: "/trust/security", pattern: "/trust/:slug" },
  { name: "legal", path: "/legal/privacy", pattern: "/legal/:slug", inSitemap: false },
  { name: "contact", path: "/contact", pattern: "/contact" },
];

/** The templates of the content source under test (see tests/support/content-source.ts). */
export const TEMPLATES: readonly TemplateRoute[] = isDraftRun ? DRAFT_TEMPLATES : FIXTURE_TEMPLATES;

/**
 * Paths of named templates under the content source being tested. A name that is not a template
 * at all always throws, and under fixtures every template exists, so a missing one throws too:
 * tests can never vanish silently. Only under the draft source may a template be absent (its
 * section has no draft content), and then it is left out.
 */
export function templatePaths(...names: string[]): string[] {
  return names.flatMap((name) => {
    if (!FIXTURE_TEMPLATES.some((template) => template.name === name)) {
      throw new Error(`No template named "${name}" in tests/support/routes.ts`);
    }
    const path = TEMPLATES.find((template) => template.name === name)?.path;
    if (path === undefined && !isDraftRun) {
      throw new Error(`Template "${name}" is missing from the fixture manifest`);
    }
    return path === undefined ? [] : [path];
  });
}

/** The 404 template (served for any unknown path and for every closed gate). */
export const NOT_FOUND_PATH = "/this-page-does-not-exist";

/** Whether `path` belongs to a route family pattern. */
export function matchesPattern(path: string, pattern: string): boolean {
  const have = path.split("/").filter(Boolean);
  const want = pattern.split("/").filter(Boolean);
  return (
    have.length === want.length && want.every((part, i) => part === ":slug" || part === have[i])
  );
}

/** The template family of a path. Families are the same for every content source. */
export const templateFor = (path: string): TemplateRoute | undefined =>
  FIXTURE_TEMPLATES.find((template) => matchesPattern(path, template.pattern));

/**
 * Sections behind a publication gate (ADR-022): with the `sparse` set every path below one of
 * these prefixes is absent from the sitemap and the index answers 404; with `full` they are listed.
 */
export const GATED_PREFIXES = ["/industries", "/work", "/insights", "/labs", "/careers"] as const;

export const isGatedPath = (path: string): boolean =>
  GATED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
