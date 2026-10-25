import { isUnpublished, routes } from "@vitalos/cms";
import type {
  CaseStudySummary,
  CtaView,
  IndustryLandingView,
  IndustryView,
  LandingPoint,
} from "@vitalos/cms";
import {
  Button,
  Container,
  Disclosure,
  FeatureGrid,
  Icon,
  IconTile,
  RevealItem,
  Section,
  TerminalCTA,
  TextLink,
  VisuallyHidden,
} from "@vitalos/ui";
import type { FeatureGridItem, SectionTone } from "@vitalos/ui";
import { MediaSlot } from "../../components/media-slot";
import { DraftNotice } from "../../components/placeholder-notice";
import { PageMain } from "../../components/site-chrome/PageMain";
import { isMediaSlotId } from "../../content/media-slots";
import type { MediaSlotId } from "../../content/media-slots";
import { postHref } from "../../features/content/insights/model";
import type { PostSummaryData } from "../../features/content/schemas";
import { ctaToLink } from "../../lib/view-mapping/hrefs";
import { pointIcon } from "../../lib/view-mapping/icons";
import { Band, PageIntro, renderBands } from "../commercial/bands";
import { industryTrail } from "./IndustryTemplate";

export type IndustryWithLanding = IndustryView & { landing: IndustryLandingView };

export const hasLanding = (industry: IndustryView): industry is IndustryWithLanding =>
  industry.landing !== undefined;

export interface IndustryLandingTemplateProps {
  industry: IndustryWithLanding;
  /** Slugs of the offers this deployment serves: a card for any other offer is left out. */
  offerSlugs: ReadonlySet<string>;
  /** The industry's case studies this deployment serves. */
  caseStudies: readonly CaseStudySummary[];
  /** The latest Insights of the landing's topic (empty when Insights is closed or unreachable). */
  insights: readonly PostSummaryData[];
  /** Whether the guardrail link's Insight can be linked (published, or a preview). */
  showGuardrailLink: boolean;
}

/** Visuals of the pilot cards, by the point's subject key (docs/design/IMAGE-SLOTS.md). */
const pilotVisuals: Readonly<Record<string, MediaSlotId>> = {
  bot: "health-care.agents",
  "package-check": "health-care.fauward",
};

const OFFER_PATH = /^\/offers\/([^/?#]+)$/;

/** A call to action: a safe link (`ctaToLink`), or an anchor on this page such as `#offers`. */
const pageLink = (cta: CtaView) =>
  /^#[a-z][a-z0-9-]*$/.test(cta.href) ? { label: cta.label, href: cta.href } : ctaToLink(cta);

/** The offer cards whose offer this deployment serves (a card never links to a missing page). */
export function servedOfferPoints(
  points: readonly LandingPoint[],
  offerSlugs: ReadonlySet<string>,
): LandingPoint[] {
  return points.filter((point) => {
    const slug = point.href ? OFFER_PATH.exec(point.href)?.[1] : undefined;
    return slug === undefined || offerSlugs.has(slug);
  });
}

const cards = (points: readonly LandingPoint[]): FeatureGridItem[] =>
  points.map((point) => ({
    icon: pointIcon(point.key),
    ...(point.title ? { title: point.title } : {}),
    text: point.text,
    ...(point.meta ? { meta: point.meta } : {}),
    ...(point.href ? { href: point.href } : {}),
  }));

/**
 * An industry's lead page (Website Build Pack, 25 Oct 2026): a heading, one line, then points of
 * eight words or fewer, each with an icon. Every word comes from the landing view; icons are
 * decorative (the text always says it) and hidden from assistive technology. Built from the
 * site's bands, so the motion toggle, reduced motion and the tone contrast pairs apply unchanged.
 */
export function IndustryLandingTemplate({
  industry,
  offerSlugs,
  caseStudies,
  insights,
  showGuardrailLink,
}: Readonly<IndustryLandingTemplateProps>) {
  const landing = industry.landing;
  const primary = pageLink(landing.primaryCta);
  const secondary = pageLink(landing.secondaryCta);
  const heroSlot = `${industry.slug}.hero`;
  const offers = servedOfferPoints(landing.offers.points, offerSlugs);
  const guardrailLink = showGuardrailLink ? ctaToLink(landing.guardrails.link) : undefined;
  const closingPrimary = ctaToLink(landing.closing.primary);
  const closingSecondary = ctaToLink(landing.closing.secondary);

  return (
    <PageMain>
      <PageIntro
        crumbs={industryTrail(industry)}
        eyebrow={landing.eyebrow}
        title={landing.heading}
        lead={landing.lead}
        actions={
          <div className="flex flex-wrap gap-(--space-3)">
            {primary ? (
              <Button href={primary.href} variant="primary" size="lg" arrow>
                {primary.label}
              </Button>
            ) : null}
            {secondary ? (
              <Button href={secondary.href} variant="secondary" size="lg">
                {secondary.label}
              </Button>
            ) : null}
          </div>
        }
        media={isMediaSlotId(heroSlot) ? <MediaSlot id={heroSlot} priority /> : undefined}
      />
      <DraftNotice show={isUnpublished(landing)} />
      {renderBands(
        [
          (tone) => (
            <Band tone={tone} heading={landing.painPoints.heading}>
              <FeatureGrid items={cards(landing.painPoints.points)} columns={4} />
            </Band>
          ),
          (tone) =>
            offers.length > 0 ? (
              <div id={landing.offers.anchor} className="scroll-mt-24">
                <Band tone={tone} heading={landing.offers.heading}>
                  <FeatureGrid items={cards(offers)} columns={offers.length >= 4 ? 4 : 3} />
                </Band>
              </div>
            ) : null,
          (tone) => (
            <Band tone={tone} heading={landing.steps.heading}>
              <Steps points={landing.steps.points} />
            </Band>
          ),
          () => (
            <Band tone="dark" heading={landing.guardrails.heading}>
              <div className="grid gap-x-(--space-7) md:grid-cols-2">
                <PointList points={landing.guardrails.does} />
                <PointList points={landing.guardrails.doesNot} />
              </div>
              {guardrailLink ? (
                <p className="m-0 mt-(--space-6)">
                  <TextLink href={guardrailLink.href}>{guardrailLink.label}</TextLink>
                </p>
              ) : null}
            </Band>
          ),
          (tone) => (
            <Band tone={tone} heading={landing.pilots.heading}>
              <Pilots points={landing.pilots.points} />
              {ctaToLink(landing.pilots.cta) ? (
                <div className="mt-(--space-7)">
                  <Button href={landing.pilots.cta.href} variant="primary" size="lg" arrow>
                    {landing.pilots.cta.label}
                  </Button>
                </div>
              ) : null}
            </Band>
          ),
          (tone) => <TrustStrip tone={tone} section={landing.trust} />,
          (tone) => (
            <Band tone={tone} heading={landing.caseStudies.heading}>
              {caseStudies.length > 0 ? (
                <CaseStudyCards studies={caseStudies.slice(0, 3)} />
              ) : (
                <FeatureGrid items={cards([landing.caseStudies.fallback])} columns={2} />
              )}
            </Band>
          ),
          (tone) =>
            insights.length > 0 ? (
              <Band tone={tone} heading={landing.insights.heading}>
                <FeatureGrid
                  items={insights.map((post) => ({
                    icon: "document" as const,
                    title: post.title,
                    meta: post.format.label,
                    text: post.excerpt,
                    href: postHref(post.slug),
                  }))}
                />
              </Band>
            ) : null,
          (tone) =>
            landing.faq.length > 0 ? (
              <Band tone={tone} heading="Frequently asked questions">
                <div className="max-w-(--container-content)">
                  {landing.faq.map((entry, index) => (
                    <Disclosure key={`${entry.question}-${index}`} summary={entry.question}>
                      <p className="m-0 text-body text-tone-text">{entry.answer}</p>
                    </Disclosure>
                  ))}
                </div>
              </Band>
            ) : null,
        ],
        "light",
      )}
      <TerminalCTA
        variant="feature"
        heading={landing.closing.heading}
        primary={closingPrimary}
        {...(closingSecondary ? { secondary: closingSecondary } : {})}
      />
    </PageMain>
  );
}

/** The four-step strip: an ordered list, numbered visibly and by the list itself. */
function Steps({ points }: Readonly<{ points: readonly LandingPoint[] }>) {
  return (
    <ol className="m-0 grid list-none grid-cols-1 gap-(--space-4) p-0 md:grid-cols-2 lg:grid-cols-4">
      {points.map((point, index) => (
        <RevealItem
          as="li"
          key={`${point.key}-${index}`}
          className="flex min-w-0 flex-col gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg p-(--space-6)"
        >
          <span className="flex items-center justify-between">
            <IconTile name={pointIcon(point.key)} />
            <span aria-hidden="true" className="font-mono text-small text-tone-muted">
              {String(index + 1).padStart(2, "0")}
            </span>
          </span>
          {point.title ? <h3 className="m-0 text-h3 text-tone-heading">{point.title}</h3> : null}
          <p className="m-0 text-body text-tone-text">{point.text}</p>
        </RevealItem>
      ))}
    </ol>
  );
}

/** A list of one-line points with their icon in a small circle (the callout's two columns). */
function PointList({ points }: Readonly<{ points: readonly LandingPoint[] }>) {
  return (
    <ul className="m-0 list-none p-0">
      {points.map((point, index) => (
        <RevealItem
          as="li"
          key={`${point.key}-${index}`}
          className="flex items-start gap-(--space-4) border-t border-tone-border py-(--space-4) text-body-l text-tone-text"
        >
          <span
            aria-hidden="true"
            className="mt-(--space-1) inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-tone-tile-bg text-tone-tile-fg"
          >
            <Icon name={pointIcon(point.key)} size={16} />
          </span>
          <span className="min-w-0">{point.text}</span>
        </RevealItem>
      ))}
    </ul>
  );
}

/** The products in pilot: a 4:3 visual, the icon, the name and one line. */
function Pilots({ points }: Readonly<{ points: readonly LandingPoint[] }>) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2">
      {points.map((point, index) => {
        const slot = pilotVisuals[point.key];
        return (
          <RevealItem
            as="li"
            key={`${point.key}-${index}`}
            className="flex min-w-0 flex-col gap-(--space-5) rounded-2xl border border-tone-border bg-tone-bg p-(--space-5)"
          >
            {slot ? <MediaSlot id={slot} sizes="(min-width: 768px) 45vw, 100vw" /> : null}
            <span className="flex items-start gap-(--space-4)">
              <IconTile name={pointIcon(point.key)} />
              <span className="min-w-0">
                {point.title ? (
                  <h3 className="m-0 text-h3 text-balance text-tone-heading">{point.title}</h3>
                ) : null}
                <p className="m-0 mt-(--space-2) text-body text-tone-text">{point.text}</p>
              </span>
            </span>
          </RevealItem>
        );
      })}
    </ul>
  );
}

/** The trust strip: one row of icon points under a heading for assistive technology only. */
function TrustStrip({
  tone,
  section,
}: Readonly<{ tone: SectionTone; section: IndustryLandingView["trust"] }>) {
  const headingId = "trust-strip-heading";
  return (
    <Section tone={tone} spacing="compact" aria-labelledby={headingId}>
      <Container size="wide">
        <h2 id={headingId} className="m-0">
          <VisuallyHidden>{section.heading}</VisuallyHidden>
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-(--space-4) p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {section.points.map((point, index) => (
            <li
              key={`${point.key}-${index}`}
              className="flex min-w-0 items-center gap-(--space-3) text-body text-tone-text"
            >
              <IconTile name={pointIcon(point.key)} size="sm" />
              <span className="min-w-0">{point.text}</span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  );
}

/** Published case studies of the industry: visual, title and one line, each a link. */
function CaseStudyCards({ studies }: Readonly<{ studies: readonly CaseStudySummary[] }>) {
  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:grid-cols-3">
      {studies.map((study) => (
        <RevealItem as="li" key={study.id} className="min-w-0">
          <a
            href={routes.caseStudy(study.slug)}
            className="group flex h-full flex-col gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg p-(--space-5) no-underline transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard) hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating"
          >
            <MediaSlot
              id="work.visual"
              item={study.slug}
              itemName={study.title}
              sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            />
            <h3 className="m-0 text-h3 text-balance text-tone-heading">{study.title}</h3>
            {study.summary ? (
              <p className="m-0 line-clamp-2 text-body text-tone-text">{study.summary}</p>
            ) : null}
          </a>
        </RevealItem>
      ))}
    </ul>
  );
}
