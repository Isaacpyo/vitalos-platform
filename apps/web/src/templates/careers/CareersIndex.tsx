import { navLabels, routes } from "@vitalos/cms";
import { ContentGap, Stack } from "@vitalos/ui";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeader } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { JobRow } from "./JobRow";
import type { CareersIndexData } from "./load";

/** Careers (gated on open roles): the CMS introduction, then the open roles. */
export function CareersIndex({ data }: Readonly<{ data: CareersIndexData }>) {
  const { page, jobs, draft } = data;
  return (
    <PageMain>
      <PageBand>
        <Stack gap={8}>
          <Breadcrumbs trail={[homeCrumb, { name: navLabels.careers, path: routes.careers() }]} />
          <PageHeader title={page?.heading ?? navLabels.careers} lead={page?.intro} />
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page}
            title="The Careers page heading and introduction are not set"
            description="Add a Careers route page in the Studio. Until then the page shows the navigation label as its heading."
          />
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
