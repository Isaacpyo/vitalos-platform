import type { JobSummary } from "@vitalos/cms";
import { Heading, Icon, MetaRow } from "@vitalos/ui";
import { routes } from "@vitalos/cms";
import { summaryFacts } from "./map";

/** An open role as an editorial row: one stretched link on the title, summary and facts. */
export function JobRow({ job }: Readonly<{ job: JobSummary }>) {
  const facts = summaryFacts(job);
  return (
    <article
      data-kind="job"
      className="group relative grid gap-x-(--space-6) gap-y-(--space-3) border-t border-tone-border py-(--space-5) md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <Heading level={2} size="h3" className="min-w-0">
        <a
          href={routes.job(job.slug)}
          className="text-tone-heading no-underline after:absolute after:inset-0 after:content-[''] hover:underline hover:underline-offset-4"
        >
          {job.title}
        </a>
      </Heading>
      <div className="flex min-w-0 items-start justify-between gap-(--space-4)">
        <div className="min-w-0 flex-1">
          {job.summary ? (
            <p className="m-0 text-body text-tone-text text-pretty">{job.summary}</p>
          ) : null}
          {facts.length > 0 ? (
            <MetaRow items={facts} className={job.summary ? "mt-(--space-3)" : ""} />
          ) : null}
        </div>
        <Icon name="arrow-right" size={20} className="mt-(--space-1) shrink-0 text-tone-heading" />
      </div>
    </article>
  );
}
