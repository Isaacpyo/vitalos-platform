import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { footerColumns, podcastPage, routes, validatePodcast } from "@vitalos/cms";
import { Container, PageHero, Section, podcastMarkPaths } from "@vitalos/ui";
import { getContentSource } from "../../../src/lib/cms/get-content-source";
import { heroArtwork } from "../../../src/lib/view-mapping/hero-artwork";
import { pageMetadata } from "../../../src/templates/institutional/metadata";

/** The listening apps with an owner-supplied, validated URL; none is ever invented. */
async function listeningApps() {
  const { settings } = await (await getContentSource()).getSiteChrome();
  const urls = validatePodcast(settings.podcast);
  return [
    ...(urls?.spotifyUrl
      ? [
          {
            platform: "spotify" as const,
            label: footerColumns.listenOnSpotify,
            href: urls.spotifyUrl,
          },
        ]
      : []),
    ...(urls?.appleUrl
      ? [
          {
            platform: "apple" as const,
            label: footerColumns.listenOnApplePodcasts,
            href: urls.appleUrl,
          },
        ]
      : []),
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    path: routes.podcast(),
    title: podcastPage.title,
    description: podcastPage.description,
    // Not indexed (and not in the sitemap) while the show links are placeholders: a short page
    // whose links do not yet resolve should not be in search results.
    noindex: true,
  });
}

/**
 * The podcast page (owner direction, 16 Oct 2026): a few words and one button per listening app.
 * Each button opens the show on that platform (the platform's app where it is installed). The
 * footer's Spotify and Apple links lead here. Without any podcast URL the page does not exist.
 */
export default async function PodcastPage() {
  const apps = await listeningApps();
  if (apps.length === 0) notFound();
  return (
    <main id="main" tabIndex={-1}>
      <PageHero
        tone="dark"
        size="title"
        artwork={heroArtwork("insights", "podcast")}
        eyebrow={footerColumns.podcast}
        title={podcastPage.title}
        lead={podcastPage.lead}
      />
      <Section tone="light" spacing="default">
        <Container size="wide">
          <h2 className="text-eyebrow text-tone-muted uppercase">{podcastPage.listenHeading}</h2>
          <ul className="m-0 mt-(--space-5) grid list-none gap-(--space-4) p-0 sm:grid-cols-2 lg:max-w-3xl">
            {apps.map((app) => (
              <li key={app.platform}>
                <a
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-16 items-center gap-(--space-4) rounded-2xl border border-tone-border bg-tone-bg px-(--space-6) py-(--space-4) text-body-l font-semibold text-tone-heading transition-colors hover:border-tone-heading focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    width="32"
                    height="32"
                    fill="currentColor"
                    className="shrink-0"
                  >
                    <path d={podcastMarkPaths[app.platform]} />
                  </svg>
                  <span>
                    {app.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>
    </main>
  );
}
