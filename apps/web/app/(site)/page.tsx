import type { Metadata } from "next";
import { howWeWorkStages, proposition, propositionLong, routes } from "@vitalos/cms";
import { JsonLd } from "../../src/components/json-ld";
import { LegacyAnchorRedirect } from "../../src/components/legacy-anchor-redirect";
import { loadChromeContent } from "../../src/components/site-chrome/load";
import { getSeoContext } from "../../src/features/seo/context";
import { organizationJsonLd, webSiteJsonLd } from "../../src/features/seo/json-ld";
import { homePageNode, jsonLdGraph } from "../../src/features/seo/graph";
import { buildMetadata } from "../../src/features/seo/metadata";
import { getContentSource } from "../../src/lib/cms/get-content-source";
import { deriveStages } from "../../src/lib/view-mapping/stages";
import { loadRoutePage } from "../../src/templates/commercial/load";
import { HomeTemplate } from "../../src/templates/home/HomeTemplate";
import { loadHomeSections } from "../../src/features/content/home";
import { loadProofApproach } from "../../src/templates/commercial/proof-load";

export async function generateMetadata(): Promise<Metadata> {
  const [source, { settings }] = await Promise.all([getContentSource(), loadChromeContent()]);
  const home = await source.getHomePage();
  // Title and description come from the CMS; with none the root layout's defaults apply.
  return buildMetadata({
    path: routes.home(),
    seo: home?.seo,
    defaultSeo: settings.defaultSeo,
    absoluteTitle: true,
  });
}

export default async function HomePage() {
  const source = await getContentSource();
  const [home, { gates, settings }, howWeWork, content, labs, proof] = await Promise.all([
    source.getHomePage(),
    loadChromeContent(),
    loadRoutePage("how-we-work"),
    loadHomeSections(),
    loadRoutePage("labs"),
    loadProofApproach(),
  ]);
  const ctx = { siteUrl: getSeoContext().siteUrl };
  return (
    <>
      {/* The full Organization and WebSite live here; every other page links to them by @id. */}
      <JsonLd
        data={jsonLdGraph([
          organizationJsonLd(settings, ctx),
          webSiteJsonLd(ctx),
          homePageNode({ name: proposition, description: propositionLong }, ctx),
        ])}
      />
      <LegacyAnchorRedirect />
      <HomeTemplate
        home={home}
        gates={gates}
        howWeWorkIntro={howWeWork?.intro}
        howWeWorkStages={deriveStages(howWeWork?.body, howWeWorkStages).stages}
        content={content}
        labsIntro={labs?.intro}
        proof={proof}
      />
    </>
  );
}
