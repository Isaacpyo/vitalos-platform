import { useId, type ReactNode } from "react";
import { Reveal, RevealItem } from "../../motion/Reveal";
import { cx } from "../../primitives/_internal/cx";
import { Container } from "../../primitives/Container";
import { Icon } from "../../primitives/Icon";
import { podcastMarkPaths } from "./podcast-marks";
import { SocialLinks, type SocialLink } from "./SocialLinks";
import { Wordmark, type WordmarkLogo } from "../../primitives/Wordmark";
import { hasText } from "../_internal/types";
import { FooterNav } from "./FooterNav";
import { quietLinkClasses } from "./nav-styles";
import type { SiteNavLink } from "./types";

export interface FooterColumn {
  key: string;
  heading: string;
  links: readonly SiteNavLink[];
}

export interface FooterPodcastLink {
  platform: "spotify" | "apple";
  /** Visible text next to the logo. */
  label: string;
  /** Accessible name of the link, e.g. "Listen on Spotify". Should contain the visible label. */
  accessibleName: string;
  href: string;
}

export interface FooterPodcast {
  heading: string;
  /** Line above the links. */
  intro?: string | undefined;
  links: readonly FooterPodcastLink[];
}

export interface SiteFooterProps {
  brand?:
    | {
        homeHref?: string | undefined;
        logo?: WordmarkLogo | undefined;
        wordmarkText?: string | undefined;
        /** Category descriptor. */
        descriptor?: string | undefined;
        /** Concise proposition. */
        proposition?: string | undefined;
        /** Social profiles, as a row of marks under the logo. */
        social?: readonly SocialLink[] | undefined;
      }
    | undefined;
  /**
   * Link columns (What We Do, Explore, Company, Trust, Legal ...). A column with no links is
   * omitted: the footer is an institutional close, not a directory of every URL.
   */
  columns: readonly FooterColumn[];
  /**
   * Podcast block, rendered in the last column position (where the Legal column used to be).
   * Omitted when it has no links; a link is shown only when its URL is supplied.
   */
  podcast?: FooterPodcast | undefined;
  /** Legal links (privacy notice, cookies, terms, sitemap ...), on the right of the bottom row. */
  legalLinks?: readonly SiteNavLink[] | undefined;
  /** Accessible name of the legal links navigation. */
  legalNavLabel?: string | undefined;
  /** Registered company information, on the left of the bottom row. Rendered only for the lines supplied. */
  legalIdentity?:
    | {
        heading?: string | undefined;
        lines: readonly string[];
      }
    | undefined;
  /** Accessible name of the footer navigation. */
  navLabel?: string | undefined;
  className?: string | undefined;
}

/**
 * Midnight institutional close of the page. Every string comes from props. The brand block and
 * the link columns rise in, in sequence, the first time they scroll into view (Reveal; static
 * without JavaScript and under reduced motion). Below md each link column collapses to its heading
 * and expands on its own (FooterNav); below lg every link is a 44px row.
 */
export function SiteFooter({
  brand,
  columns,
  legalIdentity,
  podcast,
  legalLinks = [],
  legalNavLabel = "Legal",
  navLabel = "Footer",
  className,
}: SiteFooterProps) {
  const footerId = useId();
  const visibleColumns = columns.filter((column) => column.links.length > 0);
  const identityLines = (legalIdentity?.lines ?? []).filter(hasText);
  const showBrand = brand !== undefined;
  const podcastLinks = podcast?.links.filter((link) => hasText(link.href)) ?? [];
  const showPodcast = Boolean(podcast) && podcastLinks.length > 0;
  const legalItems = legalLinks.filter((link) => hasText(link.href) && hasText(link.label));
  const identityText = identityLines.join(" · ");

  return (
    <footer
      data-tone="dark"
      className={cx(
        // Rounded top corners (owner direction, 15 Oct 2026). The footer overlaps the band above
        // by the radius, so the corners show that band's own surface on every page.
        "relative isolate z-10 -mt-8 overflow-hidden rounded-t-[2rem] bg-tone-bg pt-(--section-default) pb-(--space-7) text-tone-text lg:-mt-12 lg:rounded-t-[3rem]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-40 -z-10 size-[36rem] rounded-full bg-blue-600/20 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 bottom-0 -z-10 size-[30rem] rounded-full bg-aqua-600/15 blur-3xl"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
      />
      <Container size="wide">
        <Reveal
          stagger={0.05}
          className="grid gap-x-(--space-7) gap-y-(--space-7) lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]"
        >
          {showBrand ? (
            <RevealItem className="min-w-0">
              <Wordmark
                {...(brand?.homeHref ? { href: brand.homeHref } : {})}
                {...(brand?.logo ? { logo: brand.logo } : {})}
                {...(brand?.wordmarkText ? { text: brand.wordmarkText } : {})}
              />
              {hasText(brand?.descriptor) ? (
                <p className="mt-(--space-4) max-w-xs text-small text-tone-muted">
                  {brand.descriptor}
                </p>
              ) : null}
              {hasText(brand?.proposition) ? (
                <p className="mt-(--space-3) max-w-(--container-prose) text-body text-tone-text">
                  {brand.proposition}
                </p>
              ) : null}
              {brand?.social && brand.social.length > 0 ? (
                <SocialLinks links={brand.social} className="mt-(--space-5)" />
              ) : null}
            </RevealItem>
          ) : null}
          {visibleColumns.length > 0 || showPodcast ? (
            <FooterNav
              label={navLabel}
              className="min-w-0 border-t border-tone-border md:border-t-0"
            >
              <div className="grid grid-cols-1 gap-x-(--space-6) md:grid-cols-3 md:gap-y-(--space-6) xl:grid-cols-5">
                {visibleColumns.map((column) => {
                  const headingId = `${footerId}-${column.key}`;
                  return (
                    <ColumnShell key={column.key} headingId={headingId} heading={column.heading}>
                      <ul
                        aria-labelledby={headingId}
                        className="m-0 list-none p-0 pb-(--space-4) md:mt-(--space-3) md:pb-0"
                      >
                        {column.links.map((link) => (
                          <li key={`${link.href}-${link.label}`}>
                            <a
                              href={link.href}
                              className={cx(
                                quietLinkClasses,
                                "flex min-h-11 items-center py-(--space-1) text-body lg:block lg:min-h-0 lg:text-small",
                              )}
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </ColumnShell>
                  );
                })}
                {showPodcast && podcast ? (
                  <ColumnShell headingId={`${footerId}-podcast`} heading={podcast.heading}>
                    <div className="pb-(--space-4) md:mt-(--space-3) md:pb-0">
                      {hasText(podcast.intro) ? (
                        <p className="m-0 text-body text-tone-text lg:text-small">
                          {podcast.intro}
                        </p>
                      ) : null}
                      <ul
                        aria-labelledby={`${footerId}-podcast`}
                        className="m-0 list-none p-0 lg:mt-(--space-2)"
                      >
                        {podcastLinks.map((link) => (
                          <li key={link.platform}>
                            <a
                              href={link.href}
                              rel="noopener"
                              aria-label={link.accessibleName}
                              className={cx(
                                quietLinkClasses,
                                "inline-flex min-h-11 items-center gap-(--space-2) py-(--space-1) text-body lg:min-h-0 lg:text-small",
                              )}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width={20}
                                height={20}
                                fill="currentColor"
                                aria-hidden="true"
                                focusable="false"
                                className="shrink-0"
                              >
                                <path d={podcastMarkPaths[link.platform]} />
                              </svg>
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </ColumnShell>
                ) : null}
              </div>
            </FooterNav>
          ) : null}
        </Reveal>
        {identityLines.length > 0 || legalItems.length > 0 ? (
          <div className="mt-(--space-8) flex flex-col gap-x-(--space-7) gap-y-(--space-4) border-t border-tone-border pt-(--space-6) md:flex-row md:items-center md:justify-between">
            {identityLines.length > 0 ? (
              <div className="min-w-0">
                {hasText(legalIdentity?.heading) ? (
                  <h2 className="text-eyebrow text-tone-muted uppercase">
                    {legalIdentity.heading}
                  </h2>
                ) : null}
                <p
                  className={cx(
                    "m-0 text-small text-tone-muted",
                    hasText(legalIdentity?.heading) && "mt-(--space-3)",
                  )}
                >
                  {identityText}
                </p>
              </div>
            ) : null}
            {legalItems.length > 0 ? (
              <nav aria-label={legalNavLabel} className="min-w-0 md:ml-auto">
                <ul className="m-0 flex list-none flex-wrap gap-x-(--space-5) p-0">
                  {legalItems.map((link) => (
                    <li key={`${link.href}-${link.label}`}>
                      <a
                        href={link.href}
                        className={cx(
                          quietLinkClasses,
                          "inline-flex min-h-11 items-center py-(--space-1) text-small md:min-h-0",
                        )}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </div>
        ) : null}
        {brand?.logo ? (
          // A large, faint lockup closes the footer: decorative (the wordmark above is the link).
          <img
            src={brand.logo.src}
            width={brand.logo.width}
            height={brand.logo.height}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="pointer-events-none mx-auto mt-(--space-8) block h-auto w-full max-w-5xl opacity-[0.05] select-none"
          />
        ) : null}
      </Container>
    </footer>
  );
}

/** One collapsible footer column: heading (with chevron below md) and its content. */
function ColumnShell({
  headingId,
  heading,
  children,
}: {
  headingId: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <RevealItem className="min-w-0 border-b border-tone-border md:border-b-0 md:border-l md:pl-(--space-5)">
      <details open className="group/column">
        <summary
          className={cx(
            "flex min-h-11 cursor-pointer list-none items-center justify-between gap-(--space-4) py-(--space-2)",
            "marker:hidden md:min-h-0 md:cursor-default md:py-0 [&::-webkit-details-marker]:hidden",
          )}
        >
          <h2 id={headingId} className="text-eyebrow text-tone-eyebrow uppercase">
            {heading}
          </h2>
          <Icon
            name="chevron-down"
            className="shrink-0 text-tone-muted transition-transform duration-(--duration-disclosure) ease-(--ease-standard) group-open/column:rotate-180 md:hidden"
          />
        </summary>
        {children}
      </details>
    </RevealItem>
  );
}
