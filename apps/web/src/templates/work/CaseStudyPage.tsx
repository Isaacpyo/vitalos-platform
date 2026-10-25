import { isUnpublished, navLabels, routes } from "@vitalos/cms";
import type { CaseStudyView } from "@vitalos/cms";
import {
  MetaRow,
  OutcomeStats,
  RelatedContentRail,
  Stack,
  Testimonial,
  isNonEmpty,
} from "@vitalos/ui";
import { SubjectIconTile } from "@vitalos/ui/subject-icons";
import { DraftNotice, PlaceholderNotice } from "../../components/placeholder-notice";
import { pointIcon } from "../../lib/view-mapping/icons";
import { RichText } from "../../components/rich-text";
import { Breadcrumbs, homeCrumb } from "../institutional/breadcrumbs";
import { ContentSection, PageBand, PageHeroBand } from "../institutional/layout";
import { PageMain } from "../institutional/page-main";
import { hasRichText } from "../institutional/rich";
import type { CaseStudyData } from "./load";
import {
  caseStudyFacts,
  publishableTestimonial,
  relatedLinks,
  verifiedMetrics,
  workLabels,
} from "./map";
import { MediaSlot } from "../../components/media-slot";
import { ClosingBand } from "../commercial/bands";

/**
 * Case study detail. Outcome-led: the title and summary lead, proof (sourced, verified metrics) is
 * the visual hero, then challenge, approach and outcome from the CMS. The client is named only
 * when permitted; the testimonial is shown only for a named client (see ./map).
 */
export function CaseStudyPage({ data }: Readonly<{ data: CaseStudyData }>) {
  const { study, gates } = data;
  const metrics = verifiedMetrics(study);
  const testimonial = publishableTestimonial(study);
  const related = relatedLinks(study, gates);

  const placeholder = study.placeholder === true;

  return (
    <PageMain>
      <PageHeroBand
        media={
          study.visual ? (
            <MediaSlot id="work.visual" item={study.slug} itemName={study.visual} priority />
          ) : (
            <MediaSlot id="work.case-study" item={study.slug} itemName={study.title} priority />
          )
        }
        crumbs={
          <Breadcrumbs
            jsonLd={!placeholder}
            trail={[
              homeCrumb,
              // The Work index does not exist below its gate, so it is not a crumb then.
              ...(gates.open.work ? [{ name: navLabels.work, path: routes.work() }] : []),
              { name: study.title, path: routes.caseStudy(study.slug) },
            ]}
          />
        }
        title={study.title}
        eyebrow={study.sector}
        lead={study.summary}
      >
        <MetaRow items={caseStudyFacts(study)} />
      </PageHeroBand>
      <PlaceholderNotice show={placeholder} />
      <DraftNotice show={isUnpublished(study)} />
      <PageBand>
        <Stack gap={8}>
          <Highlights study={study} />
          {metrics ? <OutcomeStats stats={metrics} aria-label={workLabels.outcome} /> : null}

          {hasRichText(study.challenge) ? (
            <ContentSection id="challenge" heading={workLabels.challenge}>
              <RichText value={study.challenge} />
            </ContentSection>
          ) : null}
          {hasRichText(study.approach) ? (
            <ContentSection id="approach" heading={workLabels.approach}>
              <RichText value={study.approach} />
            </ContentSection>
          ) : null}
          {hasRichText(study.outcome) ? (
            <ContentSection id="outcome" heading={workLabels.outcome}>
              <RichText value={study.outcome} />
            </ContentSection>
          ) : null}

          {testimonial ? (
            <Testimonial
              quote={testimonial.quote}
              attribution={testimonial.attribution}
              role={testimonial.role}
            />
          ) : null}

          {isNonEmpty(related) ? (
            <RelatedContentRail heading={workLabels.related} items={related} />
          ) : null}
        </Stack>
      </PageBand>
      <ClosingBand />
    </PageMain>
  );
}

/**
 * The highlights strip above the story (Website Build Pack, 25 Oct 2026): three points of eight
 * words or fewer, each with a decorative icon. The list is named for assistive technology.
 */
function Highlights({ study }: Readonly<{ study: CaseStudyView }>) {
  const points = study.highlights ?? [];
  if (points.length === 0) return null;
  return (
    <ul
      aria-label={workLabels.highlights}
      className="m-0 grid list-none grid-cols-1 gap-(--space-4) p-0 md:grid-cols-3"
    >
      {points.map((point, index) => (
        <li
          key={`${point.key}-${index}`}
          className="flex min-w-0 items-center gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg p-(--space-5) text-body-l font-semibold text-tone-heading"
        >
          <SubjectIconTile name={pointIcon(point.key)} />
          <span className="min-w-0">{point.text}</span>
        </li>
      ))}
    </ul>
  );
}
