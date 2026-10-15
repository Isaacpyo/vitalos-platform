import { navLabels, routes } from "@vitalos/cms";
import {
  MetaRow,
  OutcomeStats,
  RelatedContentRail,
  Stack,
  Testimonial,
  isNonEmpty,
} from "@vitalos/ui";
import { PlaceholderNotice } from "../../components/placeholder-notice";
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
        media={<MediaSlot id="work.case-study" item={study.slug} priority />}
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
      <PageBand>
        <Stack gap={8}>
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
