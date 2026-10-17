import type { HomePageView, PublicationGates } from "@vitalos/cms";
import type { HomeData } from "../../features/content/schemas";
import type { DerivedStage } from "../../lib/view-mapping/stages";
import type { ProofApproachItem } from "../../lib/view-mapping/proof-approach";
import { PageMain } from "../../components/site-chrome/PageMain";
import { renderBands } from "../commercial/bands";
import { HeroSection, finalConversionSection, homeBands } from "./sections";

export interface HomeTemplateProps {
  /** Null when the CMS has no home page document: only the locked hero renders. */
  home: HomePageView | null;
  gates: PublicationGates;
  howWeWorkIntro?: string | undefined;
  /** The How We Work stages with their descriptions, for the lifecycle ring. */
  howWeWorkStages?: readonly DerivedStage[] | undefined;
  /** The admin's Insights and Careers sections; null leaves both out. */
  content?: HomeData | null | undefined;
  /** Intro of the Labs route page (the line of Vitalos Labs, the sixth practice). */
  labsIntro?: string | undefined;
  /** "How we prove it" items (finding B3). */
  proof?: readonly ProofApproachItem[] | undefined;
}

/**
 * The homepage: a locked-copy hero, then the sections the content supports, then the closing
 * call to action. The hero never depends on the CMS, so the page always has its h1 and its two
 * actions; every other section is omitted when it has no data.
 */
export function HomeTemplate({
  home,
  gates,
  howWeWorkIntro,
  howWeWorkStages,
  content,
  labsIntro,
  proof,
}: Readonly<HomeTemplateProps>) {
  const context = home
    ? { home, gates, howWeWorkIntro, howWeWorkStages, content, labsIntro, proof }
    : null;
  return (
    <PageMain>
      <HeroSection />
      {context
        ? renderBands(
            homeBands.map((band) => (tone) => band(context, tone)),
            "light",
          )
        : null}
      {context ? finalConversionSection(context, "dark") : null}
    </PageMain>
  );
}
