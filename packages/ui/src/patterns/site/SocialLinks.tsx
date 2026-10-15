import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";

export interface SocialLink {
  /** Network name, for example "LinkedIn"; the link's accessible name is "Vitalos on <label>". */
  label: string;
  href: string;
}

export interface SocialLinksProps {
  links: readonly SocialLink[];
  /** Who the profiles belong to, for the accessible names. Defaults to "Vitalos". */
  owner?: string | undefined;
  className?: string | undefined;
}

/*
 * Brand marks from Font Awesome Free 6.7.2 by @fontawesome (https://fontawesome.com), icons
 * licensed CC BY 4.0 (https://fontawesome.com/license/free), the same marks the email layout uses
 * (packages/email-layout/assets/brand-icons). Filled, unlike the monoline Icon set, because brand
 * marks must not be redrawn.
 */
const marks: Record<string, { viewBox: string; path: ReactNode }> = {
  linkedin: {
    viewBox: "0 0 448 512",
    path: (
      <path d="M100.28 448H7.4V148.9h92.88zM53.79 108.1C24.09 108.1 0 83.5 0 53.8a53.79 53.79 0 0 1 107.58 0c0 29.7-24.1 54.3-53.79 54.3zM447.9 448h-92.68V302.4c0-34.7-.7-79.2-48.29-79.2-48.29 0-55.69 37.7-55.69 76.7V448h-92.78V148.9h89.08v40.8h1.3c12.4-23.5 42.69-48.3 87.88-48.3 94 0 111.28 61.9 111.28 142.3V448z" />
    ),
  },
  x: {
    viewBox: "0 0 512 512",
    path: (
      <path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8L200.7 275.5 26.8 48H172.4L272.9 180.9 389.2 48zM364.4 421.8h39.1L151.1 88h-42L364.4 421.8z" />
    ),
  },
};

/** The mark for a profile URL, by host; undefined for a network without one here. */
function markFor(href: string) {
  let host: string;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  if (host === "linkedin.com") return marks["linkedin"];
  if (host === "x.com" || host === "twitter.com") return marks["x"];
  return undefined;
}

/**
 * A row of social profile links: a 44px round target with the network's mark (or its name when
 * there is no mark), named "Vitalos on LinkedIn" and so on. Colours follow the tone.
 */
export function SocialLinks({ links, owner = "Vitalos", className }: SocialLinksProps) {
  const shown = links.filter((link) => link.label.trim() !== "" && link.href.trim() !== "");
  if (shown.length === 0) return null;
  return (
    <ul className={cx("m-0 flex list-none flex-wrap gap-(--space-2) p-0", className)}>
      {shown.map((link) => {
        const mark = markFor(link.href);
        return (
          <li key={link.href}>
            <a
              href={link.href}
              aria-label={`${owner} on ${link.label}`}
              className={cx(
                "inline-flex size-11 items-center justify-center rounded-full border border-tone-border text-tone-heading no-underline",
                "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:border-tone-heading",
                !mark && "w-auto px-(--space-4) text-small font-semibold",
              )}
            >
              {mark ? (
                <svg
                  viewBox={mark.viewBox}
                  width={16}
                  height={16}
                  fill="currentColor"
                  aria-hidden="true"
                  focusable="false"
                >
                  {mark.path}
                </svg>
              ) : (
                link.label
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
