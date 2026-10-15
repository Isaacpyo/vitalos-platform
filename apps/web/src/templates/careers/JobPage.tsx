import { navLabels, routes } from "@vitalos/cms";
import { Button, MetaRow, Stack, Tag } from "@vitalos/ui";
import type { MetaItem } from "@vitalos/ui";
import { JsonLd } from "../../components/json-ld";
import { PlaceholderNotice } from "../../components/placeholder-notice";
import { RichText } from "../../components/rich-text";
import { getSeoContext } from "../../features/seo/context";
import { jobPostingJsonLd } from "../../features/seo/json-ld";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { formatDate } from "../institutional/format";
import { PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import type { JobData } from "./load";
import { applyLink, careersLabels, employmentTypeLabel, isOpenRole } from "./map";

function time(label: string, value: string | undefined): MetaItem | null {
  const text = formatDate(value);
  return text && value ? { label, value: <time dateTime={value}>{text}</time> } : null;
}

/**
 * Job page. JobPosting structured data only for an open, unexpired role (the builder returns null
 * otherwise); a closed role keeps its page, says so, and offers no application link.
 */
export function JobPage({ data }: Readonly<{ data: JobData }>) {
  const { job, gates, now } = data;
  const open = isOpenRole(job, now);
  const apply = applyLink(job);
  const type = employmentTypeLabel(job.employmentType);
  const facts = [
    job.location?.trim() ? { label: careersLabels.location, value: job.location } : null,
    type ? { label: careersLabels.employmentType, value: type } : null,
    time(careersLabels.posted, job.datePosted),
    time(careersLabels.closes, job.validThrough),
  ].filter((item): item is MetaItem => item !== null);

  const placeholder = job.placeholder === true;

  return (
    <PageMain>
      {open ? (
        <JsonLd data={jobPostingJsonLd(job, { siteUrl: getSeoContext().siteUrl }, now)} />
      ) : null}
      <PageHeroBand
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[
              homeCrumb,
              // The Careers index does not exist while there are no open roles.
              ...(gates.open.careers ? [{ name: navLabels.careers, path: routes.careers() }] : []),
              { name: job.title, path: routes.job(job.slug) },
            ]}
          />
        }
        title={job.title}
        lead={job.summary}
      >
        {open ? null : <Tag>{careersLabels.closed}</Tag>}
        <MetaRow items={facts} />
      </PageHeroBand>
      <PlaceholderNotice show={placeholder} />
      <PageBand>
        <Stack gap={8}>
          {hasRichText(job.description) ? <RichText value={job.description} /> : null}
          {open ? (
            <div>
              <Button href={apply.href} {...(apply.external ? { rel: "noopener noreferrer" } : {})}>
                {apply.label}
              </Button>
            </div>
          ) : null}
        </Stack>
      </PageBand>
    </PageMain>
  );
}
