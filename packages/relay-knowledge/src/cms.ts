import {
  gateForKind,
  hrefForDocument,
  hrefForRoutePage,
  isSitemapEligible,
  routePageKeys,
  routes,
  trustTopics,
} from "@vitalos/cms";
import type { ContentSource, PublicationGates, RichText, RoutePageKey } from "@vitalos/cms";
import { createRepoContentSource } from "@vitalos/cms/repo";
import { checksumOf } from "@vitalos/relay-core/knowledge";
import type { KnowledgeEntry } from "@vitalos/relay-core/knowledge";

/** Route pages behind a publication gate (mirrors apps/web route gates, ADR-022). */
const ROUTE_PAGE_GATES: Partial<Record<RoutePageKey, Parameters<typeof isSitemapEligible>[0]>> = {
  work: "work",
  insights: "insights",
  labs: "labs",
  industries: "industries",
  careers: "careers",
};

/**
 * Paths a visitor can open today: the home page, route pages and documents whose publication gate
 * is open (the same rules as the sitemap). Relay links only to these.
 */
export async function listPublicPaths(
  source: ContentSource = createRepoContentSource(),
): Promise<Set<string>> {
  const [gates, home, entries] = await Promise.all([
    source.getPublicationGates(),
    source.getHomePage(),
    source.getSitemapEntries(),
  ]);
  const paths = new Set<string>();
  if (home) paths.add(routes.home());
  for (const key of routePageKeys) {
    const page = await source.getRoutePage(key);
    if (!page) continue;
    if (!isSitemapEligible(ROUTE_PAGE_GATES[key], gates)) continue;
    paths.add(hrefForRoutePage(key));
  }
  for (const entry of entries) {
    if (!entry.path.startsWith("/") || /[?#\s]/.test(entry.path)) continue;
    if (!isSitemapEligible(gateForKind(entry.kind), gates)) continue;
    paths.add(entry.path);
  }
  return paths;
}

/** Portable Text to markdown: headings, paragraphs and lists; links become plain text. */
export function richTextToMarkdown(body: RichText | undefined): string {
  if (!body) return "";
  const lines: string[] = [];
  for (const block of body) {
    if (block._type !== "block") continue;
    const text = ((block.children as { text?: unknown }[] | undefined) ?? [])
      .map((c) => (typeof c.text === "string" ? c.text : ""))
      .join("")
      .trim();
    if (!text) continue;
    const style = typeof block.style === "string" ? block.style : "normal";
    if (block.listItem) lines.push(`${block.listItem === "number" ? "1." : "-"} ${text}`);
    else if (/^h[2-6]$/.test(style)) lines.push("", `${"#".repeat(Number(style[1]))} ${text}`, "");
    else lines.push("", text, "");
  }
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const list = (title: string, items: readonly string[]) =>
  items.length ? `## ${title}\n\n${items.map((i) => `- ${i}`).join("\n")}` : "";

const join = (...parts: (string | undefined | null | false)[]) =>
  parts.filter(Boolean).join("\n\n");

function entry(
  input: Omit<
    KnowledgeEntry,
    "checksum" | "adminMeta" | "status" | "owner" | "reviewDate" | "externalId"
  > & { externalId: string },
): KnowledgeEntry {
  const base = {
    ...input,
    status: "published" as const,
    owner: "Website content (repo)",
    reviewDate: null,
    adminMeta: {},
  };
  return {
    ...base,
    checksum: checksumOf({ title: base.title, url: base.url, type: base.type, body: base.bodyMd }),
  };
}

/**
 * Published website content as knowledge (source `cms`): practices, solutions, offers, industries
 * and trust topics whose pages are public. Placeholder documents never appear (the repo source
 * drops them, ADR-028).
 */
export async function cmsEntries(
  source: ContentSource = createRepoContentSource(),
): Promise<KnowledgeEntry[]> {
  const paths = await listPublicPaths(source);
  const out: KnowledgeEntry[] = [];
  const gates: PublicationGates = await source.getPublicationGates();
  void gates;

  for (const s of await source.listSummaries("practice")) {
    const d = await source.getDocument("practice", s.slug);
    if (!d) continue;
    const url = hrefForDocument({ kind: "practice", slug: d.slug });
    if (!paths.has(url)) continue;
    out.push(
      entry({
        source: "cms",
        sourceRef: `cms:practice:${d.slug}`,
        externalId: `practice:${d.slug}`,
        title: d.title,
        url,
        type: "practice",
        bodyMd: join(
          d.summary,
          d.proposition,
          list("Problems we solve", d.problems),
          list("Capabilities", d.capabilities),
          richTextToMarkdown(d.body),
        ),
        meta: {
          page_placements: [url],
          origin_path: "packages/cms/src/draft/content/practices.ts",
        },
      }),
    );
  }

  for (const s of await source.listSummaries("solution")) {
    const d = await source.getDocument("solution", s.slug);
    if (!d) continue;
    const url = hrefForDocument({ kind: "solution", slug: d.slug });
    if (!paths.has(url)) continue;
    out.push(
      entry({
        source: "cms",
        sourceRef: `cms:solution:${d.slug}`,
        externalId: `solution:${d.slug}`,
        title: d.title,
        url,
        type: "solution",
        bodyMd: join(
          d.summary,
          d.problemStatement,
          list("Signs you need this", d.signals),
          d.impact,
          richTextToMarkdown(d.approach),
          d.phases.length
            ? `## Phases\n\n${d.phases.map((p) => `- ${p.title}: ${p.description}`).join("\n")}`
            : "",
          d.offers.length
            ? `## Related offers\n\n${d.offers.map((o) => `- ${o.title}`).join("\n")}`
            : "",
          d.faq.length
            ? `## Questions\n\n${d.faq.map((f) => `### ${f.question}\n\n${f.answer}`).join("\n\n")}`
            : "",
        ),
        meta: {
          page_placements: [url],
          origin_path: "packages/cms/src/draft/content/solutions.ts",
        },
      }),
    );
  }

  for (const s of await source.listSummaries("offer")) {
    const d = await source.getDocument("offer", s.slug);
    if (!d) continue;
    const url = hrefForDocument({ kind: "offer", slug: d.slug });
    if (!paths.has(url)) continue;
    out.push(
      entry({
        source: "cms",
        sourceRef: `cms:offer:${d.slug}`,
        externalId: `offer:${d.slug}`,
        title: d.title,
        url,
        type: "offer",
        bodyMd: join(
          d.summary,
          `## Who it is for\n\n${d.audience}`,
          `## When to choose it\n\n${d.trigger}`,
          `## Scope\n\n${d.scope}`,
          list("What you get", d.outputs),
          list("What we need from you", d.requirements),
          d.durationCategory ? `## Duration\n\n${d.durationCategory}` : "",
          list("Not included", d.exclusions),
          `## Next step\n\n${d.nextStep}`,
        ),
        meta: { page_placements: [url], origin_path: "packages/cms/src/draft/content/offers.ts" },
      }),
    );
  }

  for (const s of await source.listSummaries("industry")) {
    const d = await source.getDocument("industry", s.slug);
    if (!d) continue;
    const url = hrefForDocument({ kind: "industry", slug: d.slug });
    if (!paths.has(url)) continue;
    out.push(
      entry({
        source: "cms",
        sourceRef: `cms:industry:${d.slug}`,
        externalId: `industry:${d.slug}`,
        title: d.title,
        url,
        type: "industry",
        bodyMd: join(
          d.summary,
          list("Sector realities", d.realities),
          list("Problems we solve", d.problems),
          list("AI opportunities", d.aiOpportunities),
          list("Considerations", d.considerations),
        ),
        meta: {
          page_placements: [url],
          origin_path: "packages/cms/src/draft/content/industries.ts",
        },
      }),
    );
  }

  for (const topic of trustTopics) {
    const d = await source.getDocument("trustItem", topic);
    if (!d) continue;
    const url = routes.trustTopic(topic);
    if (!paths.has(url)) continue;
    const body = join(
      d.summary,
      richTextToMarkdown(d.publicSummary),
      d.certifications.length
        ? list(
            "Certifications",
            d.certifications.map((c) => `${c.name} (${c.scope})`),
          )
        : "",
      d.subprocessors.length
        ? list(
            "Subprocessors",
            d.subprocessors.map((p) => `${p.name}: ${p.purpose}`),
          )
        : "",
    );
    if (!body.trim()) continue;
    out.push(
      entry({
        source: "cms",
        sourceRef: `cms:trust:${topic}`,
        externalId: `trust:${topic}`,
        title: d.title,
        url,
        type: "policy",
        bodyMd: body,
        meta: { page_placements: [url], origin_path: "packages/cms/src/draft/content/trust.ts" },
      }),
    );
  }
  return out;
}
