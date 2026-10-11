import { cx } from "../../primitives/_internal/cx";
import { Heading, type HeadingLevel } from "../../primitives/Heading";
import { Icon } from "../../primitives/Icon";
import { hasText, isNonEmpty, type NonEmptyArray } from "../_internal/types";

export interface ResourceLink {
  label: string;
  href: string;
  /** What it is, for example the format or size, supplied by the caller. */
  description?: string | undefined;
  /** Leaves the site: shows the outbound indicator. */
  external?: boolean | undefined;
}

export interface ResourceLinksProps {
  /** Visible heading, supplied by the caller. Omitted when the page supplies its own. */
  heading?: string | undefined;
  /** Live, safe repository, demo or download links only. Renders nothing when empty. */
  links: NonEmptyArray<ResourceLink>;
  headingLevel?: HeadingLevel | undefined;
  /** Accessible name when no visible heading is shown. */
  "aria-label"?: string | undefined;
  className?: string | undefined;
}

/** Downloadable resources and repository/demo links for a technical asset. */
export function ResourceLinks({
  heading,
  links,
  headingLevel = 3,
  "aria-label": ariaLabel,
  className,
}: ResourceLinksProps) {
  if (!isNonEmpty(links)) return null;
  return (
    <div className={cx("min-w-0", className)}>
      {hasText(heading) ? (
        <Heading level={headingLevel} size="h4">
          {heading}
        </Heading>
      ) : null}
      <ul
        {...(ariaLabel && !hasText(heading) ? { "aria-label": ariaLabel } : {})}
        className="m-0 mt-(--space-3) list-none p-0"
      >
        {links.map((link) => (
          <li
            key={link.href}
            className="border-t border-tone-border py-(--space-3) first:border-t-0"
          >
            <a
              href={link.href}
              className="inline-flex items-center gap-(--space-2) font-semibold text-tone-link underline underline-offset-4 hover:text-tone-link-hover"
            >
              <span>{link.label}</span>
              <Icon name={link.external ? "arrow-up-right" : "arrow-right"} size={16} />
            </a>
            {hasText(link.description) ? (
              <p className="m-0 mt-(--space-1) text-small text-tone-muted">{link.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
