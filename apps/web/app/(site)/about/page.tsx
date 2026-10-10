import type { Metadata } from "next";
import { navLabels, routes } from "@vitalos/cms";
import { AboutPage } from "../../../src/templates/about/AboutPage";
import { loadAbout } from "../../../src/templates/about/load";
import { pageMetadata } from "../../../src/templates/institutional/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const { page } = await loadAbout();
  return pageMetadata({
    path: routes.about(),
    title: page?.heading ?? navLabels.about,
    seo: page?.seo,
    // Without an About document the page has nothing of its own to index.
    noindex: page === null,
  });
}

export default async function AboutRoute() {
  return <AboutPage data={await loadAbout()} />;
}
