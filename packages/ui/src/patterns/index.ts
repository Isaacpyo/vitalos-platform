// Composite patterns (site chrome, cards, proof, trust, article). Owned by workstream B.
// Props are plain local types that structurally match the @vitalos/cms view models; @vitalos/ui
// never imports @vitalos/cms. Every visible string comes from props.

// Shared prop shapes
export {
  isNonEmpty,
  type ItemHeadingLevel,
  type NonEmptyArray,
  type PatternImage,
  type PatternLink,
} from "./_internal/types";

// Section layout (ADR-023, from the owner comp)
export { SectionHeading, type SectionHeadingProps } from "./layout/SectionHeading";
export { PageHero, type PageHeroProps } from "./layout/PageHero";
export { HeroVisual, type HeroVisualProps } from "./media/HeroVisual";
export {
  MediaPlaceholder,
  type MediaPlaceholderProps,
  type MediaPlaceholderVariant,
} from "./media/MediaPlaceholder";

// Site chrome
export { SiteHeader, type SiteHeaderProps } from "./site/SiteHeader";
export { MegaMenu, type MegaMenuProps } from "./site/MegaMenu";
export { MobileNav, type MobileNavProps } from "./site/MobileNav";
export { SiteFooter, type FooterColumn, type SiteFooterProps } from "./site/SiteFooter";
export { SocialLinks, type SocialLink, type SocialLinksProps } from "./site/SocialLinks";
export { TerminalCTA, type TerminalCTAProps } from "./site/TerminalCTA";
export type {
  MegaMenuColumn,
  MegaMenuFeature,
  SiteNavItem,
  SiteNavLink,
  SiteNavMenu,
} from "./site/types";

// Commercial
export {
  IndustryRow,
  OfferRow,
  PracticeRow,
  type IndustryRowProps,
  type OfferRowProps,
  type PracticeRowProps,
} from "./commercial/rows";
export {
  LinkCard,
  SolutionCard,
  type LinkCardKind,
  type LinkCardProps,
  type SolutionCardProps,
} from "./commercial/cards";
export { RelatedContentRail, type RelatedContentRailProps } from "./commercial/RelatedContentRail";
export {
  PracticeShowcase,
  type PracticeShowcaseImage,
  type PracticeShowcaseItem,
  type PracticeShowcaseProps,
} from "./commercial/PracticeShowcase";

// Proof
export { OutcomeStats, type OutcomeStatItem, type OutcomeStatsProps } from "./proof/OutcomeStats";
export { ProofStrip, type ProofStripItem, type ProofStripProps } from "./proof/ProofStrip";
export { Testimonial, type TestimonialProps } from "./proof/Testimonial";
export {
  CaseStudyFeature,
  CaseStudyRow,
  type CaseStudyFeatureProps,
  type CaseStudyRowProps,
} from "./proof/CaseStudy";

// Labs
export { MaturityBadge, type MaturityBadgeProps, type MaturityKey } from "./labs/MaturityBadge";
export { LabAssetRow, type LabAssetRowProps } from "./labs/LabAssetRow";
export { TechnicalFigure, type TechnicalFigureProps } from "./labs/TechnicalFigure";
export {
  EvaluationTable,
  type EvaluationRow,
  type EvaluationTableProps,
} from "./labs/EvaluationTable";
export { ResourceLinks, type ResourceLink, type ResourceLinksProps } from "./labs/ResourceLinks";

// Trust
export {
  CertificationItem,
  EvidenceRequestCTA,
  PolicySummary,
  SubprocessorTable,
  TrustTopicRow,
  type CertificationItemProps,
  type EvidenceRequestCTAProps,
  type PolicySummaryProps,
  type SubprocessorRow,
  type SubprocessorTableProps,
  type TrustTopicRowProps,
} from "./trust/trust";

// Insights
export {
  ArticleFeature,
  ArticleRow,
  type ArticleFeatureProps,
  type ArticleRowProps,
} from "./insights/articles";
export { AuthorMeta, type AuthorLink, type AuthorMetaProps } from "./insights/AuthorMeta";
export {
  TableOfContents,
  type TableOfContentsProps,
  type TocItem,
} from "./insights/TableOfContents";
export { CodeBlock, type CodeBlockProps } from "./insights/CodeBlock";
export { Figure, type FigureProps } from "./insights/Figure";

// Journey
export {
  ProcessJourney,
  type JourneyStage,
  type ProcessJourneyProps,
} from "./journey/ProcessJourney";

// People
export {
  PersonCard,
  PersonHero,
  type PersonCardProps,
  type PersonHeroProps,
} from "./people/people";

// Draft-only
export { ContentGap, type ContentGapProps } from "./ContentGap";
