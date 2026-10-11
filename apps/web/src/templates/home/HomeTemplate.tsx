import type { HomePageView, PublicationGates } from "@vitalos/cms";
import { PageMain } from "../../components/site-chrome/PageMain";
import { renderBands } from "../commercial/bands";
import { HeroSection, finalConversionSection, homeBands } from "./sections";

export interface HomeTemplateProps {
  /** Null when the CMS has no home page document: only the locked hero renders. */
  home: HomePageView | null;
  gates: PublicationGates;
  howWeWorkIntro?: string | undefined;
}

/**
 * The homepage: a locked-copy hero, then the sections the content supports, then the closing
 * call to action. The hero never depends on the CMS, so the page always has its h1 and its two
 * actions; every other section is omitted when it has no data.
 */
export function HomeTemplate({ home, gates, howWeWorkIntro }: Readonly<HomeTemplateProps>) {
  const context = home ? { home, gates, howWeWorkIntro } : null;
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
