import type { ReactNode } from "react";
import {
  aiJourneyStages,
  brandLine,
  ctas,
  descriptor,
  navLabels,
  practiceNames,
  proposition,
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
  Eyebrow,
  IndustryRow,
  LabAssetRow,
  ArticleRow,
  Lead,
  PersonCard,
  PracticeRow,
  ProcessJourney,
  ProofStrip,
  Section,
  SolutionCard,
  TerminalCTA,
  TextLink,
  TrustTopicRow,
  isNonEmpty,
} from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { contactHref, ctaToLink } from "../../lib/view-mapping/hrefs";
import { orderByLockedNames } from "../../lib/view-mapping/ordering";
import {
  caseStudyMeta,
  labAssetPresentation,
  toArticleRow,
  toPersonCard,
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

/** 1. Hero. Locked copy only: descriptor, proposition as the h1, brand line, two actions. */
export function HeroSection(): ReactNode {
  return (
    <Section as="div" tone="muted" spacing="large">
      <Container size="wide">
        <Eyebrow className="mb-(--space-4)">{descriptor}</Eyebrow>
        <Display size="xl" as="h1" className="max-w-(--container-max) break-words">
          {proposition}
        </Display>
        <Lead className="mt-(--space-5)">{brandLine}</Lead>
        <CTAGroup className="mt-(--space-7)">
          <Button href={contactHref()} size="lg">
            {ctas.primary}
          </Button>
          <Button href={routes.whatWeDo()} variant="text" size="lg">
            {ctas.secondary}
          </Button>
        </CTAGroup>
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

/** 3. Problems we solve: the Solutions, in the order the specs fix. */
export const problemsSection: SectionRender = (context, tone) => {
  const title = heading(context, "problems");
  const cards = orderByLockedNames(context.home.solutions, solutionNames).flatMap((solution) => {
    const card = toSolutionCard(solution, { headingLevel: itemLevel(title) });
    return card ? [card] : [];
  });
  if (cards.length === 0) return null;
  return (
    <Band tone={tone} heading={title}>
      <CardGrid>
        {cards.map((card) => (
          <li key={card.href} className="min-w-0">
            <SolutionCard {...card} />
          </li>
        ))}
      </CardGrid>
    </Band>
  );
};

/** 4. From strategy to production: the How We Work introduction (CMS) and a link to the page. */
export const strategyToProductionSection: SectionRender = (context, tone) => {
  const title = heading(context, "strategyToProduction");
  const intro = context.howWeWorkIntro?.trim();
  if (!title || !intro) return null;
  return (
    <Band tone={tone} heading={title}>
      <Lead>{intro}</Lead>
      <p className="mt-(--space-5)">
        <TextLink href={routes.howWeWork()}>{navLabels.howWeWork}</TextLink>
      </p>
    </Band>
  );
};

/** 5. Practices: the five, in the order the specs fix. */
export const practicesSection: SectionRender = (context, tone) => {
  const title = heading(context, "practices");
  const rows = toRows("practice", orderByLockedNames(context.home.practices, practiceNames), {
    headingLevel: itemLevel(title),
  });
  if (rows.length === 0) return null;
  return (
    <Band tone={tone} heading={title}>
      <RowList>
        {rows.map((row) => (
          <PracticeRow key={row.href} {...row} />
        ))}
      </RowList>
    </Band>
  );
};

/**
 * 6. AI at the centre: the signature AI journey. The stage names are locked copy (Stage 9
 * section 19); the section appears when the CMS supplies its heading. Dark emphasis surface.
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
    <Band tone={tone} heading={title}>
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

/** 8. Industries: only when the Industries gate is open. */
export const industriesSection: SectionRender = (context, tone) => {
  if (!context.gates.open.industries) return null;
  const title = heading(context, "industries");
  const rows = toRows("industry", context.home.industries, { headingLevel: itemLevel(title) });
  if (rows.length === 0) return null;
  return (
    <Band tone={tone} heading={title}>
      <RowList>
        {rows.map((row) => (
          <IndustryRow key={row.href} {...row} />
        ))}
      </RowList>
    </Band>
  );
};

/** 9. Trust: highlighted topics and a link to the Trust Centre. */
export const trustSection: SectionRender = (context, tone) => {
  const title = heading(context, "trust");
  const rows = toRows("trustItem", context.home.trustHighlights, {
    headingLevel: itemLevel(title),
  });
  if (rows.length === 0) return null;
  return (
    <Band tone={tone} heading={title}>
      <RowList>
        {rows.map((row) => (
          <TrustTopicRow key={row.href} {...row} />
        ))}
      </RowList>
      <p className="mt-(--space-5)">
        <TextLink href={routes.trust()}>{navLabels.trustCentre}</TextLink>
      </p>
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
    <Band tone={tone} heading={title}>
      <RowList>
        {rows.map((row) => (
          <LabAssetRow key={row.href} {...row} />
        ))}
      </RowList>
      <p className="mt-(--space-5)">
        <TextLink href={routes.labs()}>{navLabels.labs}</TextLink>
      </p>
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
    <Band tone={tone} heading={title}>
      <RowList>
        {rows.map((row) => (
          <ArticleRow key={row.href} {...row} />
        ))}
      </RowList>
      <p className="mt-(--space-5)">
        <TextLink href={routes.insights()}>{navLabels.insights}</TextLink>
      </p>
    </Band>
  );
};

/** 12. Leadership: named, accountable people with an approved portrait when there is one. */
export const leadershipSection: SectionRender = (context, tone) => {
  const title = heading(context, "leadership");
  const cards = context.home.leadership.flatMap((person) => {
    const card = toPersonCard(person, { headingLevel: itemLevel(title) });
    return card ? [card] : [];
  });
  if (cards.length === 0) return null;
  return (
    <Band tone={tone} heading={title}>
      <ul className="m-0 grid list-none grid-cols-1 gap-(--space-6) p-0 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <li key={card.href} className="min-w-0">
            <PersonCard {...card} />
          </li>
        ))}
      </ul>
      <p className="mt-(--space-6)">
        <TextLink href={routes.leadership()}>{navLabels.leadership}</TextLink>
      </p>
    </Band>
  );
};

/**
 * 13. Final conversion: needs its heading from the CMS. The action is the CMS call to action, or
 * the locked "Talk to Vitalos" to the contact page.
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
  trustSection,
  labsSection,
  insightsSection,
  leadershipSection,
];
