import { navLabels, routes } from "@vitalos/cms";
import { PersonCard, Stack } from "@vitalos/ui";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import type { LeadershipData } from "./load";
import { leaderCardProps } from "./map";

/** Leadership: each profile's portrait (when approved), name, role and summary, linking to the profile. */
export function LeadershipPage({ data }: Readonly<{ data: LeadershipData }>) {
  const { page, leaders } = data;
  const placeholder = hasPlaceholder(leaders);
  return (
    <PageMain>
      <PlaceholderNotice show={placeholder} />
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[
              homeCrumb,
              { name: navLabels.about, path: routes.about() },
              { name: navLabels.leadership, path: routes.leadership() },
            ]}
          />
        }
        title={page?.heading ?? navLabels.leadership}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
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
