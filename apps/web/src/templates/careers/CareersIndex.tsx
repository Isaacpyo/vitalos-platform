import { navLabels, routes } from "@vitalos/cms";
import { Stack } from "@vitalos/ui";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { JobRow } from "./JobRow";
import type { CareersIndexData } from "./load";

/** Careers (gated on open roles): the CMS introduction, then the open roles. */
export function CareersIndex({ data }: Readonly<{ data: CareersIndexData }>) {
  const { page, jobs } = data;
  const placeholder = hasPlaceholder(jobs);
  return (
    <PageMain>
      <PlaceholderNotice show={placeholder} />
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[homeCrumb, { name: navLabels.careers, path: routes.careers() }]}
          />
        }
        title={page?.heading ?? navLabels.careers}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
          <ul className="m-0 list-none p-0">
            {jobs.map((job) => (
              <li key={job.id}>
                <JobRow job={job} />
              </li>
            ))}
          </ul>
        </Stack>
      </PageBand>
    </PageMain>
  );
}
