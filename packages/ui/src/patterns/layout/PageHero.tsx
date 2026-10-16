import type { ReactNode } from "react";
import { cx } from "../../primitives/_internal/cx";
import { Container, type ContainerSize } from "../../primitives/Container";
import { CTAGroup } from "../../primitives/CTAGroup";
import { Display } from "../../primitives/Display";
import { Eyebrow } from "../../primitives/Eyebrow";
import { Heading } from "../../primitives/Heading";
import { Lead } from "../../primitives/Lead";
import { Section } from "../../primitives/Section";
import { hasText } from "../_internal/types";

export interface PageHeroProps {
  /** The page's single h1. */
  title: string;
  eyebrow?: string | undefined;
  lead?: string | undefined;
  /** Rendered above the eyebrow, for example the breadcrumb. */
  before?: ReactNode;
  /** Rendered directly under the h1, before the lead (a maturity badge, a status). */
  afterTitle?: ReactNode;
  /** Actions under the lead, usually one primary link. */
  actions?: ReactNode;
  /** Extra content at the end of the hero (a definition list, a summary). */
  children?: ReactNode;
  /** display: large display type (commercial pages); title: the H1 role (content pages). */
  size?: "display" | "title";
  /** Width of the content, matching the bands that follow (wide by default). */
  containerSize?: ContainerSize | undefined;
  /**
   * `light` (default): the light field with an angled plane. `dark`: the homepage hero's language
   * on an inner page: a dark band that starts under the clear header (SiteHeader `overlay`), with
   * rounded bottom corners and an optional photograph under a heavy black overlay.
   */
  tone?: "light" | "dark" | undefined;
  /** Dark tone only: a decorative photograph behind the band (pre-sized, same origin). */
  backdrop?: PageHeroBackdrop | undefined;
  /** Dark tone only: media beside the copy from lg (an illustration, a photograph, a MediaSlot). */
  media?: ReactNode;
  className?: string | undefined;
}

export interface PageHeroBackdrop {
  src: string;
  srcSet?: string | undefined;
  /** `sizes` for `srcSet`. Default `100vw`. */
  sizes?: string | undefined;
  width: number;
  height: number;
}

/**
 * First band of an inner page, from the owner comp: a light field with a faint angled plane on
 * the right, the eyebrow, a large title and the lead, closed by a hairline rule. The plane is
 * decorative (token tints, hidden from assistive technology) and is never behind the text on
 * compact screens. Every string comes from props.
 */
export function PageHero({
  title,
  eyebrow,
  lead,
  before,
  afterTitle,
  actions,
  children,
  size = "display",
  containerSize = "wide",
  tone = "light",
  backdrop,
  media,
  className,
}: PageHeroProps) {
  if (tone === "dark") {
    return (
      <DarkPageHero
        {...{ title, eyebrow, lead, before, afterTitle, actions, size, containerSize, backdrop }}
        media={media}
        className={className}
      >
        {children}
      </DarkPageHero>
    );
  }
  return (
    <Section
      as="div"
      tone="light"
      spacing="default"
      className={cx("relative isolate overflow-hidden border-b border-tone-border", className)}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 -z-10 hidden w-1/2 md:block"
      >
        <div className="absolute inset-y-0 right-[-20%] left-[10%] -skew-x-12 bg-linear-to-r from-transparent via-blue-50 to-blue-50" />
        <div className="absolute inset-y-0 right-[-30%] left-[62%] -skew-x-12 border-l border-white bg-linear-to-b from-blue-50 to-transparent" />
      </div>
      <Container size={containerSize}>
        {before ? <div className="mb-(--space-6)">{before}</div> : null}
        {hasText(eyebrow) ? <Eyebrow className="mb-(--space-3)">{eyebrow}</Eyebrow> : null}
        {size === "display" ? (
          <Display size="l" as="h1" className="max-w-(--container-content) break-words">
            {title}
          </Display>
        ) : (
          <Heading level={1} className="max-w-(--container-content) break-words">
            {title}
          </Heading>
        )}
        {afterTitle ? <div className="mt-(--space-4)">{afterTitle}</div> : null}
        {hasText(lead) ? <Lead className="mt-(--space-5)">{lead}</Lead> : null}
        {actions ? <CTAGroup className="mt-(--space-6)">{actions}</CTAGroup> : null}
        {children ? <div className="mt-(--space-7)">{children}</div> : null}
      </Container>
    </Section>
  );
}

/** Black is not in the locked palette; the owner asked for it on the hero photograph. */
const blackOverlay = "bg-[#000]/80"; // raw-colour-ok: owner-directed black overlay (15 Oct 2026)

/**
 * The dark page hero (owner direction, 15 Oct 2026: every page takes the homepage's design). The
 * band starts under the clear header and runs to the top; its bottom corners are rounded like the
 * homepage hero. Behind the copy: the photograph (when given) under an 80% black overlay, a blue
 * glow and a faint grid, all decorative and static, so no pause switch is needed (WCAG 2.2.2).
 * `display` is the full hero of a top-level page; `title` is the compact hero of a detail page.
 * Media sits beside the copy from lg and under it on compact screens.
 */
function DarkPageHero({
  title,
  eyebrow,
  lead,
  before,
  afterTitle,
  actions,
  children,
  size,
  containerSize,
  backdrop,
  media,
  className,
}: Omit<PageHeroProps, "tone">) {
  const full = size === "display";
  return (
    <Section
      as="div"
      tone="dark"
      spacing="default"
      className={cx(
        "relative isolate -mt-(--size-header) overflow-hidden rounded-b-[1.75rem] lg:rounded-b-[3rem]",
        full
          ? "pt-[calc(var(--section-default)+var(--size-header))]"
          : "pt-[calc(var(--section-compact)+var(--size-header))] pb-(--section-compact)",
        className,
      )}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        {backdrop ? (
          <>
            <img
              src={backdrop.src}
              srcSet={backdrop.srcSet}
              sizes={backdrop.sizes ?? "100vw"}
              width={backdrop.width}
              height={backdrop.height}
              alt=""
              fetchPriority="high"
              decoding="async"
              className="size-full object-cover object-[70%_center]"
            />
            <div className={`absolute inset-0 ${blackOverlay}`} />
          </>
        ) : null}
        {/* Glows as gradients inside the band (never boxes past its edge, which accessibility
            checkers would read as the background of the band below). */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40rem_28rem_at_0%_100%,color-mix(in_srgb,var(--color-blue-600)_28%,transparent),transparent_70%),radial-gradient(ellipse_32rem_24rem_at_100%_0%,color-mix(in_srgb,var(--color-aqua-600)_16%,transparent),transparent_70%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,color-mix(in_srgb,var(--color-white)_4%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--color-white)_4%,transparent)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_70%_40%,black,transparent_75%)]" />
      </div>
      <Container
        size={containerSize ?? "wide"}
        className={cx(
          "grid items-center gap-x-(--space-8) gap-y-(--space-8)",
          media ? "lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]" : undefined,
        )}
      >
        <div className="min-w-0">
          {before ? <div className="mb-(--space-6)">{before}</div> : null}
          {hasText(eyebrow) ? <Eyebrow className="mb-(--space-3)">{eyebrow}</Eyebrow> : null}
          {full ? (
            <Display size="l" as="h1" className="max-w-(--container-content) break-words">
              {title}
            </Display>
          ) : (
            <Heading level={1} className="max-w-(--container-content) break-words">
              {title}
            </Heading>
          )}
          {afterTitle ? <div className="mt-(--space-4)">{afterTitle}</div> : null}
          {hasText(lead) ? (
            <Lead className="mt-(--space-5) max-w-(--container-prose)">{lead}</Lead>
          ) : null}
          {actions ? <CTAGroup className="mt-(--space-7)">{actions}</CTAGroup> : null}
          {children ? <div className="mt-(--space-7)">{children}</div> : null}
        </div>
        {/* Compact screens: the media stays small under the copy, so the first screen keeps the
            title, lead and action (designed for 390px, not shrunk). */}
        {media ? (
          <div className="w-full max-w-60 min-w-0 md:max-w-sm lg:max-w-none">{media}</div>
        ) : null}
      </Container>
    </Section>
  );
}
