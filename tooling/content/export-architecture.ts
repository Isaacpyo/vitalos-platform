// Writes superadmin/apps/architecture/data/web-architecture.json: the website's practices, solutions
// and offers (titles, summaries, public paths and links) from the repo content set, for the Super
// Admin's `manage.py sync_architecture_from_web` (ADR-049). Labs is the sixth practice
// (decision 1), linking to /labs. Read-only: it copies published repo copy, nothing new. Each
// solution and offer lists its parents in the authors' order (lead first).
//
// Run: corepack pnpm --filter @vitalos/relay-knowledge exec tsx ../../tooling/content/export-architecture.ts
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { offerDrafts } from "../../packages/cms/src/draft/content/offers";
import { solutionDrafts } from "../../packages/cms/src/draft/content/solutions";
import { repoContent } from "../../packages/cms/src/repo/index";

interface Ref {
  slug: string;
}

const slugs = (refs: readonly Ref[] | undefined): string[] => (refs ?? []).map((ref) => ref.slug);

// The resolved views list related practices and solutions in a fixed order; the drafts keep the
// authors' order, whose first entry is the lead (where the admin tree files the record).
const authored = (
  drafts: readonly { slug: string; practices?: readonly string[]; solutions?: readonly string[] }[],
  key: "practices" | "solutions",
): Map<string, string[]> => new Map(drafts.map((draft) => [draft.slug, [...(draft[key] ?? [])]]));
const solutionPractices = authored(solutionDrafts, "practices");
const offerSolutions = authored(offerDrafts, "solutions");

const docs = repoContent.documents;
const labsPage = repoContent.routePages.labs;

const practices = docs.practice.map((practice, order) => ({
  slug: practice.slug,
  title: practice.title,
  summary: practice.summary ?? "",
  path: `/what-we-do/${practice.slug}`,
  order,
  solutions: slugs(practice.solutions),
}));
if (!practices.some((practice) => practice.slug === "labs")) {
  practices.push({
    slug: "labs",
    title: "Vitalos Labs",
    summary: labsPage?.intro ?? "",
    path: "/labs",
    order: practices.length,
    solutions: [],
  });
}

const solutions = docs.solution.map((solution, order) => ({
  slug: solution.slug,
  title: solution.title,
  summary: solution.summary ?? "",
  path: `/solutions/${solution.slug}`,
  order,
  practices: solutionPractices.get(solution.slug) ?? slugs(solution.practices),
  offers: slugs(solution.offers),
}));

const offers = docs.offer.map((offer, order) => ({
  slug: offer.slug,
  title: offer.title,
  summary: offer.summary ?? "",
  path: `/offers/${offer.slug}`,
  order,
  solutions: offerSolutions.get(offer.slug) ?? slugs(offer.solutions),
  practices: slugs(offer.practices),
}));

const target = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../superadmin/apps/architecture/data/web-architecture.json",
);
writeFileSync(
  target,
  `${JSON.stringify({ source: "packages/cms/src/repo (repo content set)", practices, solutions, offers }, null, 2)}\n`,
);
console.log(
  `Wrote ${target}: ${practices.length} practices, ${solutions.length} solutions, ${offers.length} offers`,
);
