import type { ReactNode } from "react";
import { Container, Icon } from "@vitalos/ui";

/**
 * Presentation primitives for the Vitalos AI & Data section (AID-002). Server components, no
 * client JavaScript. Colours come only from the `ai-data` token scope (`--aid-*`, set by
 * `data-aid-tone` on a band), so every text/surface pair is one ai-data.test.ts verifies.
 */

export type AidTone = "dark" | "light" | "muted";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export interface BandProps {
  tone: AidTone;
  /** id of the band's heading, for `aria-labelledby`. */
  labelledBy?: string;
  /** Vertical rhythm: compact for supporting bands, default otherwise. */
  spacing?: "compact" | "default" | "large";
  /** Fine grid lines behind the content (decorative). */
  grid?: boolean;
  className?: string;
  children: ReactNode;
}

const spacingClasses = {
  compact: "py-(--section-compact)",
  default: "py-(--section-default)",
  large: "py-(--section-large)",
} as const;

/**
 * One full-width band. Dark near-black for heroes and closing calls to action; light (white) and
 * muted (very light cool grey) alternate in between.
 */
export function Band({
  tone,
  labelledBy,
  spacing = "default",
  grid = false,
  className,
  children,
}: Readonly<BandProps>) {
  return (
    <section
      data-aid-tone={tone}
      aria-labelledby={labelledBy}
      className={cx(
        "relative isolate overflow-hidden bg-aid-bg text-aid-text",
        spacingClasses[spacing],
        className,
      )}
    >
      {grid ? <GridLines /> : null}
      <Container size="content" className="relative">
        {children}
      </Container>
    </section>
  );
}

/** Fine 64px grid lines in the band's rule colour, fading out downwards. Decorative. */
export function GridLines() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 [background-image:linear-gradient(to_right,var(--aid-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--aid-border)_1px,transparent_1px)] [background-size:64px_64px] [background-position:center_top] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
    />
  );
}

/** Small uppercase category line above a heading. */
export function Eyebrow({
  children,
  className,
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <p
      className={cx(
        "m-0 font-mono text-eyebrow tracking-[0.14em] text-aid-eyebrow uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}

export interface SectionHeadingProps {
  id: string;
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  /** Heading level: 2 for page sections (default), 1 only for a page title. */
  level?: 1 | 2;
  className?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  lead,
  level = 2,
  className,
}: Readonly<SectionHeadingProps>) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={cx("flex max-w-(--container-prose) flex-col gap-(--space-4)", className)}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading
        id={id}
        className={cx(
          "m-0 text-balance text-aid-heading",
          level === 1 ? "text-display-l" : "text-h2",
        )}
      >
        {title}
      </Heading>
      {lead ? <div className="m-0 text-body-l text-aid-muted">{lead}</div> : null}
    </div>
  );
}

/** A label chip such as "Synthetic data". Text, never colour alone, carries the meaning. */
export function LabelChip({
  children,
  icon,
  size = "md",
}: Readonly<{
  children: ReactNode;
  icon?: "info" | "warning" | "document";
  /** `lg` for the page-level labels a visitor must not miss. */
  size?: "md" | "lg";
}>) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-(--space-2) rounded-sm border border-aid-line bg-aid-chip-bg font-semibold text-aid-chip-text",
        size === "lg"
          ? "px-(--space-4) py-(--space-2) text-body"
          : "px-(--space-3) py-(--space-1) text-small",
      )}
    >
      {icon ? <Icon name={icon} size={size === "lg" ? 20 : 16} className="shrink-0" /> : null}
      {children}
    </span>
  );
}

/** A list with fine check marks. */
export function CheckList({
  items,
  className,
}: Readonly<{ items: readonly ReactNode[]; className?: string }>) {
  return (
    <ul className={cx("m-0 flex list-none flex-col gap-(--space-3) p-0", className)}>
      {items.map((item, index) => (
        <li key={index} className="flex gap-(--space-3)">
          <Icon name="check" size={20} className="mt-0.5 shrink-0 text-aid-accent" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** A text link with a trailing arrow, for onward navigation inside a band. */
export function ArrowLink({
  href,
  children,
  className,
}: Readonly<{ href: string; children: ReactNode; className?: string }>) {
  return (
    <a
      href={href}
      className={cx(
        "group inline-flex min-h-11 items-center gap-(--space-2) font-semibold text-aid-link underline decoration-1 underline-offset-4 hover:text-aid-link-hover",
        className,
      )}
    >
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="transition-transform duration-(--duration-feedback) motion-safe:group-hover:translate-x-0.5"
      >
        →
      </span>
    </a>
  );
}

/** A bordered panel on the band's raised surface. */
export function Panel({
  children,
  className,
  as: Tag = "div",
  id,
}: Readonly<{
  children: ReactNode;
  className?: string;
  as?: "div" | "article" | "li";
  id?: string | undefined;
}>) {
  return (
    <Tag
      id={id}
      className={cx(
        "flex min-w-0 flex-col gap-(--space-4) rounded-xl border border-aid-border bg-aid-surface p-(--space-5) transition-[border-color,box-shadow] duration-(--duration-feedback) ease-(--ease-standard) hover:border-aid-line hover:shadow-floating md:p-(--space-6)",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
