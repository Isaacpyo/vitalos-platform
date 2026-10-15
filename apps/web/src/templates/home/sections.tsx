import { useId } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  aiJourneyStages,
  ctas,
  howWeWorkStages,
  megaMenuColumns,
  navLabels,
  practiceNames,
  proposition,
  propositionLong,
  routes,
  solutionNames,
} from "@vitalos/cms";
import type { HomePageView, HomeSectionKey, PublicationGates } from "@vitalos/cms";
import {
  Button,
  CTAGroup,
  Carousel,
  CaseStudyFeature,
  CaseStudyRow,
  Container,
  Display,
  HeroVisual,
  LabAssetRow,
  LinkCard,
  ArticleRow,
  MotionPause,
  Lead,
  PracticeRow,
  ProcessJourney,
  ProofStrip,
  Reveal,
  Section,
  RevealItem,
  SectionHeading,
  SettleText,
  SolutionCard,
  TerminalCTA,
  isNonEmpty,
} from "@vitalos/ui";
import type { MediaPlaceholderVariant } from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { iconFor } from "../../lib/view-mapping/icons";
import { carouselLabels, heroMotionPauseLabel } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import {
  caseStudyMeta,
  labAssetPresentation,
  toArticleRow,
  toProofStripItems,
  toRow,
  toRows,
  toSolutionCard,
} from "../../lib/view-mapping/patterns";
import { Band, CardGrid, RowList, itemLevel } from "../commercial/bands";

/**
 * The thirteen homepage sections of Stage 8 section 8, in order. Each is a function of the home
 * view model, the publication gates and the CMS route page it borrows from, and returns null
 * when it has no data: nothing is invented to fill a slot (Stage 10 section 14, "Homepage Wave 1
 * reality"). Visible headings come from `home.headings`; a section without an authored heading
 * renders none (the structural labels in locked copy are for editors and are never shown).
 */
export interface HomeContext {
  home: HomePageView;
  gates: PublicationGates;
  /** Intro of the How We Work route page, borrowed for "From strategy to production". */
  howWeWorkIntro?: string | undefined;
}

type SectionRender = (context: HomeContext, tone: SectionTone) => ReactNode | null;

const heading = (context: HomeContext, key: HomeSectionKey) => context.home.headings[key];

/**
 * The proposition with its closing clause in the brand colour, as the comp sets the end of its
 * headline, its words settling into place on load. Presentation only: the text (and so the
 * accessible name) is the locked string.
 */
function PropositionTitle() {
  const split = proposition.lastIndexOf("Adopt ");
  const parts =
    split === -1
      ? [{ text: proposition }]
      : [{ text: proposition.slice(0, split) }, { text: proposition.slice(split), accent: true }];
  // The words settle into place in under 400ms, drawn at full colour from the first paint (CSS).
  return <SettleText parts={parts} />;
}

/**
 * The hero backdrop: the owner-supplied photograph (15 Oct 2026; docs/brand/asset-approval.md)
 * under a solid black overlay, so the copy reads as on a dark band. It drifts slowly and a few
 * points of light glint over the data centre (token CSS, "Ambient hero motion"). Decorative:
 * hidden from assistive technology. Served from apps/web/public as pre-sized WebP, so it skips
 * the image optimiser.
 */
const heroBackdrop = {
  src: "/images/hero/cloud-infrastructure-1672.webp",
  srcSet:
    "/images/hero/cloud-infrastructure-960.webp 960w, /images/hero/cloud-infrastructure-1672.webp 1672w",
  width: 1672,
  height: 941,
} as const;

function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP with its own srcset */}
      <img
        src={heroBackdrop.src}
        srcSet={heroBackdrop.srcSet}
        sizes="100vw"
        width={heroBackdrop.width}
        height={heroBackdrop.height}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="hv-drift size-full object-cover object-[70%_center]"
      />
      {/* Black is not in the locked palette (--color-*: initial); the owner asked for it here. */}
      <div className="absolute inset-0 bg-[#000]/60" />
      {heroGlints.map((glint, index) => (
        <span
          key={index}
          className="hv-glint absolute size-1.5 rounded-full bg-white opacity-0 shadow-[0_0_14px_4px_var(--color-blue-600)] motion-reduce:hidden"
          style={{ top: glint.top, left: glint.left, "--d": glint.delay } as CSSProperties}
        />
      ))}
    </div>
  );
}

/** Where the glints light up, over the right of the photograph, and when (staggered). */
const heroGlints = [
  { top: "24%", left: "64%", delay: "0s" },
  { top: "41%", left: "81%", delay: "1.1s" },
  { top: "63%", left: "72%", delay: "2.3s" },
  { top: "31%", left: "91%", delay: "3.2s" },
  { top: "74%", left: "88%", delay: "0.6s" },
  { top: "52%", left: "57%", delay: "4s" },
] as const;

/**
 * 1. Hero (the comp's split hero). Locked copy only: proposition as the h1, proposition
 * sentence and one action on the left; the decorative hero visual on the right (below the copy on
 * compact screens), carrying the locked AI journey stage names and no figures.
 */
export function HeroSection(): ReactNode {
  return (
    <Section
      as="div"
      tone="dark"
      spacing="default"
      data-motion-scope=""
      // Starts under the clear header (SiteHeader `overlay`), so the photograph runs to the top.
      className="relative isolate -mt-(--size-header) overflow-hidden pt-[calc(var(--section-default)+var(--size-header))]"
    >
      <HeroBackdrop />
      <MotionPause
        label={heroMotionPauseLabel}
        className="absolute right-(--space-4) bottom-(--space-4) z-10"
      />
      <Container
        size="wide"
        className="grid items-center gap-x-(--space-7) gap-y-(--space-8) lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
      >
        <div className="min-w-0">
          <Display size="xl" as="h1" className="break-words">
            <PropositionTitle />
          </Display>
          <Lead className="mt-(--space-5)">{propositionLong}</Lead>
          <CTAGroup className="mt-(--space-7)">
            <Button href={routes.whatWeDo()} variant="secondary" size="lg" arrow>
              {ctas.secondary}
            </Button>
          </CTAGroup>
        </div>
        <HeroVisual
          steps={aiJourneyStages}
          variant="glass"
          className="aspect-[4/3] w-full sm:aspect-[3/2] md:aspect-[2/1] lg:aspect-[4/5] lg:max-h-[36rem]"
        />
      </Container>
    </Section>
  );
}

/** 2. Credibility strip: verified markers only; never a placeholder logo wall. */
export const credibilitySection: SectionRender = (context, tone) => {
  const items = toProofStripItems(context.home.proof);
  if (!items) return null;
  return (
    <Band tone={tone} spacing="compact">
      <ProofStrip items={items} label={heading(context, "credibility")} />
    </Band>
  );
};

/** Grid width for a set of solution cards: the comp's row of five when all five exist. */
const solutionColumns = (count: number): 2 | 3 | 5 => (count >= 5 ? 5 : count >= 3 ? 3 : 2);

/**
 * 3. Problems we solve: the Solutions, in the order the specs fix, as the comp's row of icon
 * cards under a split section header.
 */
export const problemsSection: SectionRender = (context, tone) => {
  const title = heading(context, "problems");
  const cards = orderByLockedNames(context.home.solutions, solutionNames).flatMap((solution) => {
    const card = toSolutionCard(solution, { headingLevel: itemLevel(title) });
    return card ? [card] : [];
  });
  if (cards.length === 0) return null;
  const columns = solutionColumns(cards.length);
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={megaMenuColumns.solutions}
      link={{ label: navLabels.allWhatWeDo, href: routes.whatWeDo() }}
    >
      <CardGrid columns={columns}>
        {cards.map((card) => (
          <li key={card.href} className="min-w-0">
            <SolutionCard
              {...card}
              icon={iconFor("solution", card.title)}
              titleSize={columns === 5 ? "h4" : "h3"}
            />
          </li>
        ))}
      </CardGrid>
    </Band>
  );
};

/**
 * 4. From strategy to production (the comp's process band): the How We Work introduction (CMS)
 * and its action on the left; the locked delivery stages, numbered, on the right.
 */
export const strategyToProductionSection: SectionRender = (context, tone) => {
  const title = heading(context, "strategyToProduction");
  const intro = context.howWeWorkIntro?.trim();
  if (!title || !intro) return null;
  return <StrategyBand tone={tone} title={title} intro={intro} />;
};

function StrategyBand({
  tone,
  title,
  intro,
}: Readonly<{ tone: SectionTone; title: string; intro: string }>) {
  const headingId = useId();
  return (
    <Section tone={tone} aria-labelledby={headingId}>
      <Container
        size="wide"
        className="grid gap-x-(--space-8) gap-y-(--space-7) xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-center"
      >
        <Reveal>
          <SectionHeading id={headingId} eyebrow={navLabels.howWeWork} title={title} />
          <Lead className="mt-(--space-5)">{intro}</Lead>
          <CTAGroup className="mt-(--space-6)">
            <Button href={routes.howWeWork()} arrow>
              {navLabels.howWeWork}
            </Button>
          </CTAGroup>
        </Reveal>
        {/* The delivery stages in order: their numbers pop in one after another (diagram
            sequence, Stage 9 section 11); the stage names never move. */}
        <Reveal
          as="ol"
          stagger={0.07}
          delay={1}
          aria-label={navLabels.howWeWork}
          className="m-0 grid list-none grid-cols-2 gap-x-(--space-5) gap-y-(--space-4) p-0 sm:grid-cols-3"
        >
          {howWeWorkStages.map((stage, index) => (
            <li
              key={stage}
              className="flex min-w-0 items-center gap-(--space-3) border-t border-tone-border pt-(--space-4)"
            >
              <RevealItem
                as="span"
                effect="pop"
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-tone-tile-bg text-small font-semibold text-tone-tile-fg"
              >
                {String(index + 1).padStart(2, "0")}
              </RevealItem>
              <span className="min-w-0 text-body font-semibold text-tone-heading">{stage}</span>
            </li>
          ))}
        </Reveal>
      </Container>
    </Section>
  );
}

/** 5. Practices: the five, in the order the specs fix, as editorial rows with icon tiles. */
export const practicesSection: SectionRender = (context, tone) => {
  const title = heading(context, "practices");
  const rows = toRows("practice", orderByLockedNames(context.home.practices, practiceNames), {
    headingLevel: itemLevel(title),
  });
  if (rows.length === 0) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={megaMenuColumns.practices}
      link={{ label: navLabels.whatWeDo, href: routes.whatWeDo() }}
    >
      <RowList>
        {rows.map((row) => (
          <PracticeRow key={row.href} {...row} icon={iconFor("practice", row.title)} />
        ))}
      </RowList>
    </Band>
  );
};

/**
 * 6. AI at the centre: the signature AI journey. The stage names are locked copy (Stage 9
 * section 19); the section appears when the CMS supplies its heading. Dark emphasis surface,
 * with the comp's connected steps.
 */
export const aiAtTheCentreSection: SectionRender = (context) => {
  const title = heading(context, "aiAtTheCentre");
  const stages = aiJourneyStages.map((stage) => ({ title: stage as string }));
  if (!title || !isNonEmpty(stages)) return null;
  return (
    <Band tone="dark" heading={title}>
      <ProcessJourney stages={stages} headingLevel={3} aria-label={title} />
    </Band>
  );
};

/**
 * 7. Selected work: only when the Work gate is open (at least two verified case studies exist)
 * and the home page selects some. The mapper keeps verified case studies only; the lead one is a
 * feature, the rest rows. No metric is shown here because summaries carry none.
 */
export const selectedWorkSection: SectionRender = (context, tone) => {
  if (!context.gates.open.work) return null;
  const title = heading(context, "selectedWork");
  const level = itemLevel(title);
  const items = context.home.selectedWork.flatMap((work) => {
    const row = toRow("caseStudy", work, { meta: caseStudyMeta(work), headingLevel: level });
    return row ? [{ work, row }] : [];
  });
  if (items.length === 0) return null;
  const [lead, ...rest] = items;
  if (!lead) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={navLabels.work}
      link={{ label: navLabels.work, href: routes.work() }}
    >
      <CaseStudyFeature
        title={lead.row.title}
        href={lead.row.href}
        challenge={lead.row.summary}
        meta={lead.row.meta}
        headingLevel={level}
      />
      {rest.length > 0 ? (
        <div className="mt-(--space-6)">
          <RowList>
            {rest.map(({ row }) => (
              <CaseStudyRow key={row.href} {...row} />
            ))}
          </RowList>
        </div>
      ) : null}
    </Band>
  );
};

const placeholderCycle: readonly MediaPlaceholderVariant[] = [0, 1, 2, 3];

/**
 * 8. Industries: only when the Industries gate is open. The comp's browsable row of cards (a
 * vertical list on phones), each with a token placeholder where the comp shows a photograph.
 */
export const industriesSection: SectionRender = (context, tone) => {
  if (!context.gates.open.industries) return null;
  const title = heading(context, "industries");
  const rows = toRows("industry", context.home.industries, { headingLevel: itemLevel(title) });
  if (rows.length === 0) return null;
  const label = title ?? navLabels.industries;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={navLabels.industries}
      link={{ label: navLabels.industries, href: routes.industries() }}
    >
      <Carousel label={label} {...carouselLabels(label)}>
        {rows.map((row, index) => (
          <li key={row.href}>
            <LinkCard
              kind="industry"
              {...row}
              icon={iconFor("industry", row.title)}
              placeholder={placeholderCycle[index % placeholderCycle.length]}
              titleSize="h4"
            />
          </li>
        ))}
      </Carousel>
    </Band>
  );
};

/** 10. Labs: only when the Labs gate is open. Maturity is stated in words on every asset. */
export const labsSection: SectionRender = (context, tone) => {
  if (!context.gates.open.labs) return null;
  const title = heading(context, "labs");
  const rows = context.home.labs.flatMap((lab) => {
    const { eyebrow, maturity, maturityLabel } = labAssetPresentation(lab);
    const row = toRow("labAsset", lab, { eyebrow, headingLevel: itemLevel(title) });
    return row ? [{ ...row, maturity, maturityLabel }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={navLabels.labs}
      link={{ label: navLabels.labs, href: routes.labs() }}
    >
      <RowList>
        {rows.map((row) => (
          <LabAssetRow key={row.href} {...row} />
        ))}
      </RowList>
    </Band>
  );
};

/** 11. Insights: only when the Insights gate is open; curated by the editors, not a feed. */
export const insightsSection: SectionRender = (context, tone) => {
  if (!context.gates.open.insights) return null;
  const title = heading(context, "insights");
  const rows = context.home.insights.flatMap((insight) => {
    const row = toArticleRow(insight, { headingLevel: itemLevel(title) });
    return row ? [row] : [];
  });
  if (rows.length === 0) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={navLabels.insights}
      link={{ label: navLabels.insights, href: routes.insights() }}
    >
      <RowList>
        {rows.map((row) => (
          <ArticleRow key={row.href} {...row} />
        ))}
      </RowList>
    </Band>
  );
};

/**
 * 13. Final conversion: needs its heading from the CMS. The action is the CMS call to action, or
 * the locked "Talk to Vitalos" to the contact page. The comp's single-row closing band.
 */
export const finalConversionSection: SectionRender = (context) => {
  const title = heading(context, "finalConversion");
  if (!title) return null;
  const primary = ctaToLink(context.home.finalCta) ?? { label: ctas.primary, href: contactHref() };
  return <TerminalCTA heading={title} primary={primary} />;
};

/** Sections 2 to 12 in order; the hero and the final conversion frame them. */
export const homeBands: readonly SectionRender[] = [
  credibilitySection,
  problemsSection,
  strategyToProductionSection,
  practicesSection,
  aiAtTheCentreSection,
  selectedWorkSection,
  industriesSection,
  labsSection,
  insightsSection,
];
