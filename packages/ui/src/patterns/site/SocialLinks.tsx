import { cx } from "../../primitives/_internal/cx";
import { BrandMark, type BrandName } from "../../primitives/BrandMark";

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

/** The mark for a profile URL, by host; undefined for a network without one here. */
function markFor(href: string): BrandName | undefined {
  let host: string;
  try {
    host = new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
  if (host === "linkedin.com") return "linkedin";
  if (host === "x.com" || host === "twitter.com") return "x";
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
              {mark ? <BrandMark name={mark} /> : link.label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
