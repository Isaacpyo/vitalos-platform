import { useId } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Container } from "../../primitives/Container";
import { Wordmark, type WordmarkLogo } from "../../primitives/Wordmark";
import { hasText } from "../_internal/types";
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
      }
    | undefined;
  /**
   * Link columns (What We Do, Explore, Company, Trust, Legal ...). A column with no links is
   * omitted: the footer is an institutional close, not a directory of every URL.
   */
  columns: readonly FooterColumn[];
  /** Verified contact channels only. Omitted when there is no email and no social link. */
  contact?:
    | {
        heading: string;
        email?: string | undefined;
        social?: readonly { label: string; href: string }[] | undefined;
      }
    | undefined;
  /** Registered company information. Rendered only for the lines supplied. */
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

/** Midnight institutional close of the page. Every string comes from props. */
export function SiteFooter({
  brand,
  columns,
  contact,
  legalIdentity,
  navLabel = "Footer",
  className,
}: SiteFooterProps) {
  const footerId = useId();
  const visibleColumns = columns.filter((column) => column.links.length > 0);
  const email = hasText(contact?.email) ? contact.email : undefined;
  const social = contact?.social ?? [];
  const showContact = Boolean(contact) && (email !== undefined || social.length > 0);
  const identityLines = (legalIdentity?.lines ?? []).filter(hasText);
  const showBrand = brand !== undefined;

  return (
    <footer
      data-tone="dark"
      className={cx("bg-tone-bg text-tone-text py-(--section-default)", className)}
    >
      <Container size="wide">
        <div className="grid gap-x-(--space-7) gap-y-(--space-7) lg:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
          {showBrand ? (
            <div className="min-w-0">
              <Wordmark
                {...(brand?.homeHref ? { href: brand.homeHref } : {})}
                {...(brand?.logo ? { logo: brand.logo } : {})}
                {...(brand?.wordmarkText ? { text: brand.wordmarkText } : {})}
              />
              {hasText(brand?.descriptor) ? (
                <p className="mt-(--space-4) text-eyebrow text-tone-muted uppercase">
                  {brand.descriptor}
                </p>
              ) : null}
              {hasText(brand?.proposition) ? (
                <p className="mt-(--space-3) max-w-(--container-prose) text-body text-tone-text">
                  {brand.proposition}
                </p>
              ) : null}
            </div>
          ) : null}
          {visibleColumns.length > 0 ? (
            <nav aria-label={navLabel} className="min-w-0">
              <div className="grid grid-cols-1 gap-x-(--space-6) gap-y-(--space-6) sm:grid-cols-2 md:grid-cols-3">
                {visibleColumns.map((column) => {
                  const headingId = `${footerId}-${column.key}`;
                  return (
                    <div key={column.key} className="min-w-0">
                      <h2 id={headingId} className="text-eyebrow text-tone-muted uppercase">
                        {column.heading}
                      </h2>
                      <ul aria-labelledby={headingId} className="m-0 mt-(--space-3) list-none p-0">
                        {column.links.map((link) => (
                          <li key={`${link.href}-${link.label}`}>
                            <a
                              href={link.href}
                              className={cx(quietLinkClasses, "block py-(--space-1) text-body")}
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </nav>
          ) : null}
        </div>
        {showContact || identityLines.length > 0 ? (
          <div className="mt-(--space-8) grid gap-x-(--space-7) gap-y-(--space-6) border-t border-tone-border pt-(--space-6) md:grid-cols-2">
            {showContact && contact ? (
              <div className="min-w-0">
                <h2 className="text-eyebrow text-tone-muted uppercase">{contact.heading}</h2>
                <ul className="m-0 mt-(--space-3) list-none p-0">
                  {email ? (
                    <li>
                      <a
                        href={`mailto:${email}`}
                        className={cx(quietLinkClasses, "block py-(--space-1) text-body")}
                      >
                        {email}
                      </a>
                    </li>
                  ) : null}
                  {social.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className={cx(quietLinkClasses, "block py-(--space-1) text-body")}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {identityLines.length > 0 ? (
              <div className="min-w-0">
                {hasText(legalIdentity?.heading) ? (
                  <h2 className="text-eyebrow text-tone-muted uppercase">
                    {legalIdentity.heading}
                  </h2>
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
          </div>
        ) : null}
      </Container>
    </footer>
  );
}
