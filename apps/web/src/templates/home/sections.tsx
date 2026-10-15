import type { CSSProperties, ReactNode } from "react";
import {
  aiJourneyStages,
  ctas,
  labTypeLabels,
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
  CaseStudyFeature,
  CaseStudyRow,
  Container,
  Display,
  HeroVisual,
  LabShowcase,
  MotionPause,
  Lead,
  PracticeShowcase,
  ProofStrip,
  Section,
  SettleText,
  SolutionShowcase,
  TerminalCTA,
} from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import {
  industryShowcaseItems,
  lifecycleStages,
  practiceShowcaseItems,
  solutionShowcaseItems,
} from "../../lib/view-mapping/showcase";
import { IndustryBand, LifecycleBand } from "../commercial/dark-bands";
import { heroPhotograph } from "../../lib/view-mapping/hero-images";
import { heroMotionPauseLabel, structuralLabels } from "../../lib/view-mapping/labels";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import { typesWithAssets } from "../labs/map";
import type { DerivedStage } from "../../lib/view-mapping/stages";
import {
  caseStudyMeta,
  labAssetPresentation,
  toProofStripItems,
  toRow,
} from "../../lib/view-mapping/patterns";
import { Band, RowList, itemLevel } from "../commercial/bands";
import type { HomeData } from "../../features/content/schemas";
import { HomeCareers } from "../careers/HomeCareers";
import { HomeInsights } from "../insights/HomeInsights";

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
  /** The How We Work stages with their descriptions (`deriveStages`), for the lifecycle ring. */
  howWeWorkStages?: readonly DerivedStage[] | undefined;
  /** The admin's homepage sections (Insights, Careers); null when unconfigured or unreadable. */
  content?: HomeData | null | undefined;
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
const heroBackdrop = heroPhotograph;

/** Black is not in the locked palette (--color-*: initial); the owner asked for it here. */
const blackOverlay = "bg-[#000]/72"; // raw-colour-ok: owner-directed black overlay (15 Oct 2026)

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
      <div className={`absolute inset-0 ${blackOverlay}`} />
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
      // Rounded bottom corners (owner direction, 15 Oct 2026) show against the band below.
      className="relative isolate -mt-(--size-header) overflow-hidden rounded-b-[1.75rem] pt-[calc(var(--section-default)+var(--size-header))] lg:rounded-b-[3rem]"
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
          className="w-full lg:aspect-[4/5] lg:max-h-[36rem]"
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

/**
 * 3. Problems we solve: the Solutions, in the order the specs fix, as a showcase: numbered titles
 * on the left and a panel presenting the pointed or focused one (owner direction, 15 Oct 2026).
 */
export const problemsSection: SectionRender = (context, tone) => {
  const title = heading(context, "problems");
  const items = solutionShowcaseItems(orderByLockedNames(context.home.solutions, solutionNames), {
    headingLevel: itemLevel(title),
  });
  if (items.length === 0) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={megaMenuColumns.solutions}
      link={{ label: navLabels.allWhatWeDo, href: routes.whatWeDo() }}
    >
      <SolutionShowcase headingLevel={itemLevel(title)} items={items} />
    </Band>
  );
};

/**
 * 4. From strategy to production: the How We Work introduction beside the delivery lifecycle as
 * a ring of the nine locked stages, on the dark band (owner direction, 15 Oct 2026). Pointing
 * at, focusing or clicking a stage presents its summary, borrowed from the How We Work page. The section appears when the CMS supplies its heading and the route page an intro.
 */
export const strategyToProductionSection: SectionRender = (context) => {
  const title = heading(context, "strategyToProduction");
  const intro = context.howWeWorkIntro?.trim();
  if (!title || !intro) return null;
  return (
    <LifecycleBand title={title} intro={intro} stages={lifecycleStages(context.howWeWorkStages)} />
  );
};

/**
 * 5. Practices: the five, in the order the specs fix, as a showcase: a numbered list beside a
 * stage that shows the pointed or focused practice's illustration (owner direction, 15 Oct 2026).
 */
export const practicesSection: SectionRender = (context, tone) => {
  const title = heading(context, "practices");
  const items = practiceShowcaseItems(orderByLockedNames(context.home.practices, practiceNames), {
    headingLevel: itemLevel(title),
  });
  if (items.length === 0) return null;
  return (
    <Band
      tone={tone}
      heading={title}
      eyebrow={megaMenuColumns.practices}
      link={{ label: navLabels.whatWeDo, href: routes.whatWeDo() }}
    >
      <PracticeShowcase headingLevel={itemLevel(title)} items={items} />
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

/**
 * 9. Industries: only when the Industries gate is open. A dark band with a drifting aurora (its own
 * pause switch, WCAG 2.2.2) and the industries as expanding glass panels (owner direction, 15 Oct
 * 2026).
 */
export const industriesSection: SectionRender = (context) => {
  if (!context.gates.open.industries) return null;
  const title = heading(context, "industries");
  const items = industryShowcaseItems(context.home.industries, { headingLevel: itemLevel(title) });
  if (items.length === 0) return null;
  return <IndustryBand title={title} items={items} />;
};
/**
 * 10. Labs: only when the Labs gate is open. A bench of specimen cards (owner direction, 15 Oct
 * 2026); maturity is stated in words on every asset.
 */
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
      <LabShowcase
        headingLevel={itemLevel(title)}
        items={rows}
        more={{
          label: structuralLabels.allLabs,
          href: routes.labs(),
          types: typesWithAssets(context.home.labs).map((type) => labTypeLabels[type]),
        }}
      />
    </Band>
  );
};

/**
 * 11. Insights, from the Super Admin's `home` read (brief 5.6, ADR-035): wired into the band the
 * homepage already had. Absent when the admin returns no section (closed, disabled, nothing
 * published) and when the read failed (the homepage never fails because of it).
 */
// The brief sets this section on a white ground whatever the band rhythm around it (5.6).
export const insightsSection: SectionRender = (context) => {
  const section = context.content?.insights;
  return section && section.items.length > 0 ? <HomeInsights section={section} /> : null;
};

/**
 * 11b. Careers, from the admin's `home` read (brief 6.5), directly after Insights on its muted
 * band. Absent when the admin returns no section (closed, disabled, or no roles and set to hide)
 * and when the read failed.
 */
export const careersSection: SectionRender = (context) => {
  const section = context.content?.careers;
  return section ? <HomeCareers section={section} /> : null;
};

/**
 * 13. Final conversion: needs its heading from the CMS. The action is the CMS call to action, or
 * the locked "Talk to Vitalos" to the contact page. The comp's single-row closing band.
 */
/** The closing card's supporting line: the first sentence of the How We Work introduction. */
const closingLine = (intro: string): string => {
  const end = intro.indexOf(". ");
  return end === -1 ? intro.trim() : intro.slice(0, end + 1).trim();
};

export const finalConversionSection: SectionRender = (context) => {
  const title = heading(context, "finalConversion");
  if (!title) return null;
  const primary = ctaToLink(context.home.finalCta) ?? { label: ctas.primary, href: contactHref() };
  return (
    <TerminalCTA
      variant="feature"
      heading={title}
      {...(context.howWeWorkIntro ? { body: closingLine(context.howWeWorkIntro) } : {})}
      primary={primary}
      secondary={{ label: ctas.secondary, href: routes.whatWeDo() }}
    />
  );
};

/** Sections 2 to 12 in order; the hero and the final conversion frame them. */
export const homeBands: readonly SectionRender[] = [
  credibilitySection,
  problemsSection,
  strategyToProductionSection,
  practicesSection,
  selectedWorkSection,
  industriesSection,
  labsSection,
  insightsSection,
  careersSection,
];
