import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { LeadershipPage } from "../../../../src/templates/about/LeadershipPage";
import { loadLeadership } from "../../../../src/templates/about/load";
import { pageMetadata } from "../../../../src/templates/institutional/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { page, leaders } = await loadLeadership();
  return pageMetadata({
    path: routes.leadership(),
    title: page?.heading ?? navLabels.leadership,
    seo: page?.seo,
    // Neither a Leadership document nor a leadership profile: nothing to index yet.
    // Placeholder personas (ADR-025) are never indexed either.
    noindex:
      (page === null && leaders.length === 0) ||
      (leaders.length > 0 && leaders.every((leader) => leader.placeholder === true)),
  });
}

export default async function LeadershipRoute() {
  return <LeadershipPage data={await loadLeadership()} />;
}
