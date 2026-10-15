import { useId } from "react";
import { Reveal, RevealItem } from "../../motion/Reveal";
import { cx } from "../../primitives/_internal/cx";
import { Container } from "../../primitives/Container";
import { Icon } from "../../primitives/Icon";
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
  /** Registered company information, centred under the columns. Rendered only for the lines supplied. */
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
  navLabel = "Footer",
  className,
}: SiteFooterProps) {
  const footerId = useId();
  const visibleColumns = columns.filter((column) => column.links.length > 0);
  const identityLines = (legalIdentity?.lines ?? []).filter(hasText);
  const showBrand = brand !== undefined;

  return (
    <footer
      data-tone="dark"
      className={cx(
        "border-t border-tone-border bg-tone-bg pt-(--section-default) pb-(--section-default) text-tone-text lg:pt-(--section-compact) lg:pb-(--space-7)",
        className,
      )}
    >
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
          {visibleColumns.length > 0 ? (
            <FooterNav
              label={navLabel}
              className="min-w-0 border-t border-tone-border md:border-t-0"
            >
              <div className="grid grid-cols-1 gap-x-(--space-6) md:grid-cols-3 md:gap-y-(--space-6) xl:grid-cols-5">
                {visibleColumns.map((column) => {
                  const headingId = `${footerId}-${column.key}`;
                  return (
                    <RevealItem
                      key={column.key}
                      className="min-w-0 border-b border-tone-border md:border-b-0 md:border-l md:pl-(--space-5)"
                    >
                      <details open className="group/column">
                        <summary
                          className={cx(
                            "flex min-h-11 cursor-pointer list-none items-center justify-between gap-(--space-4) py-(--space-2)",
                            "marker:hidden md:min-h-0 md:cursor-default md:py-0 [&::-webkit-details-marker]:hidden",
                          )}
                        >
                          <h2 id={headingId} className="text-eyebrow text-tone-heading uppercase">
                            {column.heading}
                          </h2>
                          <Icon
                            name="chevron-down"
                            className="shrink-0 text-tone-muted transition-transform duration-(--duration-disclosure) ease-(--ease-standard) group-open/column:rotate-180 md:hidden"
                          />
                        </summary>
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
                      </details>
                    </RevealItem>
                  );
                })}
              </div>
            </FooterNav>
          ) : null}
        </Reveal>
        {identityLines.length > 0 ? (
          <div className="mt-(--space-8) border-t border-tone-border pt-(--space-6) text-center">
            {hasText(legalIdentity?.heading) ? (
              <h2 className="text-eyebrow text-tone-muted uppercase">{legalIdentity.heading}</h2>
            ) : null}
            <div
              className={cx(
                "text-small text-tone-muted",
                hasText(legalIdentity?.heading) && "mt-(--space-3)",
              )}
            >
              {identityLines.map((line, index) => (
                <p key={index} className="m-0">
                  {line}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </Container>
    </footer>
  );
}
