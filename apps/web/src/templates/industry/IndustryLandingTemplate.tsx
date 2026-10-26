import { isUnpublished, routes } from "@vitalos/cms";
import type { ReactNode } from "react";
import type {
  CaseStudySummary,
  CtaView,
  IndustryLandingView,
  IndustryView,
  LandingPoint,
} from "@vitalos/cms";
import { Button, RevealItem, TerminalCTA, TextLink } from "@vitalos/ui";
import { SubjectIcon, SubjectIconTile } from "@vitalos/ui/subject-icons";
import { MediaSlot } from "../../components/media-slot";
import { DraftNotice } from "../../components/placeholder-notice";
import { PageMain } from "../../components/site-chrome/PageMain";
import { isMediaSlotId } from "../../content/media-slots";
import type { MediaSlotId } from "../../content/media-slots";
import { postHref } from "../../features/content/insights/model";
import type { PostSummaryData } from "../../features/content/schemas";
import { ctaToLink } from "../../lib/view-mapping/hrefs";
import { pointIcon } from "../../lib/view-mapping/icons";
import { structuralLabels } from "../../lib/view-mapping/labels";
import { Band, PageIntro, renderBands } from "../commercial/bands";
import { Chip, FaqList, PointCard, PointGrid, PointRows, SubPoints } from "../commercial/points";
import { engagementBasisLabels } from "../work/map";
import { industryTrail } from "./IndustryTemplate";

export type IndustryWithLanding = IndustryView & { landing: IndustryLandingView };

export const hasLanding = (industry: IndustryView): industry is IndustryWithLanding =>
  industry.landing !== undefined;

/** A case study card on the lead page: who it was for (or that Vitalos runs it), title, line. */
export interface LandingCaseStudy {
  slug: string;
  title: string;
  summary?: string | undefined;
  label: string;
}

/**
 * A case study as a lead-page card. The client label is "Built and run by Vitalos" for a Vitalos
 * product, otherwise the summary's client label or the sector (the anonymised description unless
 * the client is named with permission), otherwise the engagement basis.
 */
export function landingCaseStudy(
  study: CaseStudySummary & { sector?: string | undefined },
): LandingCaseStudy {
  const product = study.kind === "product" || study.engagementBasis === "vitalos-product";
  const described = study.clientLabel?.trim() || study.sector?.trim();
  return {
    slug: study.slug,
    title: study.title,
    ...(study.summary ? { summary: study.summary } : {}),
    label: product
      ? engagementBasisLabels["vitalos-product"]
      : described || engagementBasisLabels[study.engagementBasis],
  };
}

export interface IndustryLandingTemplateProps {
  industry: IndustryWithLanding;
  /** Slugs of the offers this deployment serves: a card for any other offer is left out. */
  offerSlugs: ReadonlySet<string>;
  /**
   * The case studies shown: the industry's own once one is published; until then the landing's
   * fallback stories this deployment serves, with the design-partner card beside them.
   */
  caseStudies: readonly LandingCaseStudy[];
  /** True when `caseStudies` are the fallback stories, not the industry's own. */
  caseStudiesAreFallback: boolean;
  /** The latest Insights of the landing's topic (empty when Insights is closed or unreachable). */
  insights: readonly PostSummaryData[];
  /** Whether the guardrail link's Insight can be linked (published, or a preview). */
  showGuardrailLink: boolean;
}

/** Labels of the brief's card parts (Website Build Pack, revision 2, Part 2 sections 4 and 6). */
export const landingLabels = {
  youGet: "You get",
  bestFor: "Best for",
  youLeaveWith: "You leave with",
} as const;

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

/**
 * An industry's lead page (Website Build Pack, revision 2): sections of scannable points, each an
 * icon, a bold title and one supporting line. Every word comes from the landing view or the card
 * labels above; icons are decorative (the text always says it) and hidden from assistive
 * technology. Built from the site's bands, so the motion toggle, reduced motion and the tone
 * contrast pairs apply unchanged.
 */
export function IndustryLandingTemplate({
  industry,
  offerSlugs,
  caseStudies,
  caseStudiesAreFallback,
  insights,
  showGuardrailLink,
}: Readonly<IndustryLandingTemplateProps>) {
  const landing = industry.landing;
  const primary = pageLink(landing.primaryCta);
  const secondary = pageLink(landing.secondaryCta);
  const heroSlot = `${industry.slug}.hero`;
  const offers = servedOfferPoints(landing.offers.points, offerSlugs);
  const guardrailLink = showGuardrailLink ? ctaToLink(landing.guardrails.link) : undefined;
  const pilotCta = ctaToLink(landing.pilots.cta);
  const closingPrimary = ctaToLink(landing.closing.primary);
  const closingSecondary = ctaToLink(landing.closing.secondary);
  // Three cards: the industry's own stories, or the fallback stories and the design-partner card.
  const studies = caseStudies.slice(0, caseStudiesAreFallback ? 2 : 3);

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
      >
        <ProofChips points={landing.proof} />
      </PageIntro>
      <DraftNotice show={isUnpublished(landing)} />
      {renderBands(
        [
          (tone) => (
            <Band tone={tone} heading={landing.audiences.heading} intro={landing.audiences.intro}>
              <PointGrid points={landing.audiences.points} />
            </Band>
          ),
          (tone) => (
            <Band tone={tone} heading={landing.painPoints.heading} intro={landing.painPoints.intro}>
              <PointGrid points={landing.painPoints.points} />
            </Band>
          ),
          (tone) =>
            offers.length > 0 ? (
              <div id={landing.offers.anchor} className="scroll-mt-24">
                <Band tone={tone} heading={landing.offers.heading} intro={landing.offers.intro}>
                  <PointGrid
                    points={offers}
                    columns={2}
                    labels={{ points: landingLabels.youGet, note: landingLabels.bestFor }}
                  />
                </Band>
              </div>
            ) : null,
          (tone) => (
            <Band tone={tone} heading={landing.automation.heading} intro={landing.automation.intro}>
              <PointGrid points={landing.automation.points} />
            </Band>
          ),
          (tone) => (
            <Band tone={tone} heading={landing.steps.heading} intro={landing.steps.intro}>
              <PointGrid
                points={landing.steps.points}
                columns={4}
                numbered
                labels={{ note: landingLabels.youLeaveWith }}
              />
            </Band>
          ),
          () => (
            <Band tone="dark" heading={landing.guardrails.heading}>
              <div className="grid gap-(--space-7) lg:grid-cols-3">
                {landing.guardrails.columns.map((column) => (
                  <div key={column.heading} className="min-w-0">
                    <p className="m-0 mb-(--space-3) text-small font-semibold tracking-wide text-tone-muted uppercase">
                      {column.heading}
                    </p>
                    <PointRows points={column.points} />
                  </div>
                ))}
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
              <Pilots
                products={landing.pilots.products}
                ask={
                  <div className="flex flex-col items-start gap-(--space-5)">
                    <p className="m-0 max-w-(--container-content) text-body-l text-tone-text">
                      {landing.pilots.ask}
                    </p>
                    {pilotCta ? (
                      <Button href={pilotCta.href} variant="primary" size="lg" arrow>
                        {pilotCta.label}
                      </Button>
                    ) : null}
                  </div>
                }
              />
              {landing.pilots.benefits ? (
                <>
                  <h3 className="m-0 mt-(--space-8) text-h3 text-tone-heading">
                    {landing.pilots.benefits.heading}
                  </h3>
                  <div className="mt-(--space-5)">
                    <PointGrid points={landing.pilots.benefits.points} columns={4} />
                  </div>
                </>
              ) : null}
            </Band>
          ),
          (tone) => (
            <Band tone={tone} heading={landing.systems.heading} intro={landing.systems.intro}>
              <PointRows points={landing.systems.points} columns={3} />
              {landing.systems.note ? (
                <p className="m-0 mt-(--space-5) text-body text-tone-muted">
                  {landing.systems.note}
                </p>
              ) : null}
            </Band>
          ),
          (tone) => (
            <Band tone={tone} heading={landing.trust.heading} intro={landing.trust.intro}>
              <PointRows points={landing.trust.points} columns={3} />
            </Band>
          ),
          (tone) =>
            studies.length > 0 || caseStudiesAreFallback ? (
              <Band tone={tone} heading={landing.caseStudies.heading}>
                <ul
                  className={
                    studies.length + (caseStudiesAreFallback ? 1 : 0) >= 3
                      ? "m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:grid-cols-3"
                      : "m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:max-w-4xl"
                  }
                >
                  {studies.map((study) => (
                    <RevealItem as="li" key={study.slug} className="min-w-0">
                      <CaseStudyCard study={study} />
                    </RevealItem>
                  ))}
                  {caseStudiesAreFallback ? (
                    <RevealItem as="li" className="min-w-0">
                      <PointCard point={landing.caseStudies.fallback} />
                    </RevealItem>
                  ) : null}
                </ul>
              </Band>
            ) : null,
          (tone) =>
            insights.length > 0 ? (
              <Band tone={tone} heading={landing.insights.heading}>
                <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2 lg:grid-cols-3">
                  {insights.slice(0, 3).map((post) => (
                    <RevealItem as="li" key={post.slug} className="min-w-0">
                      <InsightCard post={post} />
                    </RevealItem>
                  ))}
                </ul>
              </Band>
            ) : null,
          (tone) =>
            landing.faq.length > 0 ? (
              <Band tone={tone} heading={structuralLabels.faq}>
                <FaqList entries={landing.faq} />
              </Band>
            ) : null,
        ],
        "light",
      )}
      <TerminalCTA
        variant="feature"
        heading={landing.closing.heading}
        body={landing.closing.line}
        primary={closingPrimary}
        {...(closingSecondary ? { secondary: closingSecondary } : {})}
      />
    </PageMain>
  );
}

/** The hero's proof chips: an icon and a few words each, under the buttons. */
function ProofChips({ points }: Readonly<{ points: readonly LandingPoint[] }>) {
  if (points.length === 0) return null;
  return (
    <ul className="m-0 mt-(--space-6) flex list-none flex-wrap gap-(--space-3) p-0">
      {points.map((point, index) => (
        <li
          key={`${point.key}-${index}`}
          className="inline-flex items-center gap-(--space-2) rounded-full border border-white/25 bg-white/10 px-(--space-4) py-(--space-2) text-small text-white"
        >
          <SubjectIcon name={pointIcon(point.key)} size={16} />
          <span>{point.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The products in pilot: a 4:3 visual, a status chip, the icon, title, line and three points. The
 * ask and its call to action sit beside a single product, or under two or more.
 */
function Pilots({
  products,
  ask,
}: Readonly<{ products: readonly LandingPoint[]; ask: ReactNode }>) {
  const single = products.length === 1;
  return (
    <>
      <ul className="m-0 grid list-none grid-cols-1 gap-(--space-5) p-0 md:grid-cols-2">
        {products.map((product, index) => {
          const slot = pilotVisuals[product.key];
          return (
            <RevealItem
              as="li"
              key={`${product.key}-${index}`}
              className="flex min-w-0 flex-col gap-(--space-5) rounded-2xl border border-tone-border bg-tone-bg p-(--space-5)"
            >
              {slot ? <MediaSlot id={slot} sizes="(min-width: 768px) 45vw, 100vw" /> : null}
              <span className="flex items-start justify-between gap-(--space-3)">
                <SubjectIconTile name={pointIcon(product.key)} />
                {product.meta ? <Chip>{product.meta}</Chip> : null}
              </span>
              <span className="block min-w-0">
                {product.title ? (
                  <h3 className="m-0 text-h3 text-balance text-tone-heading">{product.title}</h3>
                ) : null}
                <span className="mt-(--space-2) block text-body text-tone-text">
                  {product.text}
                </span>
              </span>
              {product.points ? <SubPoints points={product.points} /> : null}
            </RevealItem>
          );
        })}
        {single ? <li className="flex min-w-0 items-center md:p-(--space-6)">{ask}</li> : null}
      </ul>
      {single ? null : <div className="mt-(--space-7)">{ask}</div>}
    </>
  );
}

/** A linked card whose title is the link, its hit area stretched over the card. */
const stretchedLink =
  "text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl after:content-['']";
const liftCard =
  "group relative flex h-full flex-col rounded-2xl border border-tone-border bg-tone-bg transition-[translate,border-color,box-shadow] duration-(--duration-reveal) ease-(--ease-standard) hover:-translate-y-1 hover:border-blue-600/60 hover:shadow-floating";

/** A case study: visual, client label, title (the link) and one line. */
function CaseStudyCard({ study }: Readonly<{ study: LandingCaseStudy }>) {
  return (
    <div className={`${liftCard} gap-(--space-4) p-(--space-5)`}>
      <MediaSlot
        id="work.visual"
        item={study.slug}
        itemName={study.title}
        sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
      />
      <p className="m-0 text-small font-semibold text-tone-muted">{study.label}</p>
      <h3 className="m-0 text-h3 text-balance text-tone-heading">
        <a href={routes.caseStudy(study.slug)} className={stretchedLink}>
          {study.title}
        </a>
      </h3>
      {study.summary ? (
        <p className="m-0 line-clamp-3 text-body text-tone-text">{study.summary}</p>
      ) : null}
    </div>
  );
}

/** An Insight: type label, title (the link), one line, date and reading time. */
function InsightCard({ post }: Readonly<{ post: PostSummaryData }>) {
  return (
    <div className={`${liftCard} gap-(--space-3) p-(--space-6)`}>
      <p className="m-0 font-mono text-small tracking-wide text-tone-muted uppercase">
        {post.format.label}
      </p>
      <h3 className="m-0 text-h3 text-balance text-tone-heading">
        <a href={postHref(post.slug)} className={stretchedLink}>
          {post.title}
        </a>
      </h3>
      {post.excerpt ? (
        <p className="m-0 line-clamp-3 text-body text-tone-text">{post.excerpt}</p>
      ) : null}
      <p className="m-0 mt-auto font-mono text-small text-tone-muted uppercase">
        {`${post.publishedAt.short} · ${post.readingMinutes} min read`}
      </p>
    </div>
  );
}
