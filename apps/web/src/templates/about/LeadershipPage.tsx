import { navLabels, routes } from "@vitalos/cms";
import { ContentGap, PersonCard, Stack } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeader } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { LeadershipData } from "./load";
import { leaderCardProps } from "./map";

/** Leadership: each profile's portrait (when approved), name, role and summary, linking to the profile. */
export function LeadershipPage({ data }: Readonly<{ data: LeadershipData }>) {
  const { page, leaders, draft } = data;
  return (
    <PageMain>
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs
            trail={[
              homeCrumb,
              { name: navLabels.about, path: routes.about() },
              { name: navLabels.leadership, path: routes.leadership() },
            ]}
          />
          <PageHeader title={page?.heading ?? navLabels.leadership} lead={page?.intro} />
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && leaders.length === 0}
            title="No leadership profiles are published"
            description="Mark published people as leadership in the Studio. The page is not indexed until it has a route page or profiles."
          />
          {leaders.length > 0 ? (
            <ul className="m-0 grid list-none grid-cols-1 gap-(--space-7) p-0 sm:grid-cols-2 lg:grid-cols-3">
              {leaders.map((leader) => (
                <li key={leader.id} className="min-w-0">
                  <PersonCard {...leaderCardProps(leader)} headingLevel={2} />
                  {leader.summary ? (
                    <p className="m-0 mt-(--space-3) text-body text-tone-text">{leader.summary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </Stack>
      </PageBand>
    </PageMain>
  );
}
