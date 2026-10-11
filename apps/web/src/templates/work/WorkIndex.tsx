import { navLabels, routes } from "@vitalos/cms";
import { CaseStudyRow, ContentGap, Stack } from "@vitalos/ui";
import { PlaceholderNotice, hasPlaceholder } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { ListFilter } from "../institutional/list-filter";
import { rowFilterAttributes } from "../institutional/list-filter-model";
import { PageMain } from "../institutional/page-main";
import type { WorkIndexData } from "./load";
import { caseStudyRowProps, workFilterDimensions, workFilterGroups } from "./map";

const LIST_ID = "work-list";

/**
 * Work index (gated). Every verified case study is rendered as a crawlable row linking to its own
 * canonical page; the Industry/Solution/Practice filter is a client-side enhancement that only
 * hides rows and never writes to the URL (Stage 9 §24: no indexable query pages).
 */
export function WorkIndex({ data }: Readonly<{ data: WorkIndexData }>) {
  const { page, studies, draft } = data;
  const groups = workFilterGroups(studies);
  const placeholder = hasPlaceholder(studies);
  return (
    <PageMain>
      <PlaceholderNotice show={placeholder} />
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[homeCrumb, { name: navLabels.work, path: routes.work() }]}
          />
        }
        title={page?.heading ?? navLabels.work}
        lead={page?.intro}
      />
      <PageBand>
        <Stack gap={8}>
          <RichText value={page?.body} />
          <ContentGap
            draft={draft && !page}
            title="The Work page heading and introduction are not set"
            description="Add a Work route page in the Studio. Until then the page shows the navigation label as its heading."
          />
          <ListFilter listId={LIST_ID} groups={groups} total={studies.length} />
          <ul id={LIST_ID} className="m-0 list-none p-0">
            {studies.map((study) => (
              <li key={study.id} {...rowFilterAttributes(study, workFilterDimensions, groups)}>
                <CaseStudyRow {...caseStudyRowProps(study)} headingLevel={2} />
              </li>
            ))}
          </ul>
        </Stack>
      </PageBand>
    </PageMain>
  );
}
