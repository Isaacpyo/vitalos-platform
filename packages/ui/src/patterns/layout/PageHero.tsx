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
  className?: string | undefined;
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
  className,
}: PageHeroProps) {
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
