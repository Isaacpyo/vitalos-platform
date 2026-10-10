/**
 * Route manifest for the quality suites (ADR-021). One entry per page TEMPLATE, using the
 * artificial fixture slugs from packages/cms/src/fixtures. `pattern` is the route family as it
 * appears in sitemap.xml, so a suite can prove that the manifest has not drifted from the site: a
 * new template appears in the sitemap, matches no pattern and fails `sitemap.http.spec.ts` until it
 * is added here (and therefore to the axe, reflow, focus and JavaScript-budget sweeps).
 */
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

export const TEMPLATES: readonly TemplateRoute[] = [
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
  { name: "insights index", path: "/insights", pattern: "/insights" },
  { name: "article", path: "/insights/example-insight-1", pattern: "/insights/:slug" },
  { name: "person", path: "/people/example-person", pattern: "/people/:slug" },
  { name: "labs index", path: "/labs", pattern: "/labs" },
  { name: "labs category", path: "/labs/open-source", pattern: "/labs/:slug", inSitemap: false },
  {
    name: "lab asset",
    path: "/labs/open-source/example-open-source-tool",
    pattern: "/labs/:slug/:slug",
  },
  { name: "about", path: "/about", pattern: "/about" },
  { name: "leadership", path: "/about/leadership", pattern: "/about/leadership" },
  { name: "trust overview", path: "/trust", pattern: "/trust" },
  { name: "trust topic", path: "/trust/security", pattern: "/trust/:slug" },
  { name: "careers", path: "/careers", pattern: "/careers" },
  { name: "role", path: "/careers/example-role", pattern: "/careers/:slug" },
  { name: "legal", path: "/legal/privacy", pattern: "/legal/:slug" },
  { name: "contact", path: "/contact", pattern: "/contact" },
];

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

export const templateFor = (path: string): TemplateRoute | undefined =>
  TEMPLATES.find((template) => matchesPattern(path, template.pattern));

/**
 * Sections behind a publication gate (ADR-022): with the `sparse` set every path below one of
 * these prefixes is absent from the sitemap and the index answers 404; with `full` they are listed.
 */
export const GATED_PREFIXES = ["/industries", "/work", "/insights", "/labs", "/careers"] as const;

export const isGatedPath = (path: string): boolean =>
  GATED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
