import { useId } from "react";
import { Button } from "../../primitives/Button";
import { Container } from "../../primitives/Container";
import { CTAGroup } from "../../primitives/CTAGroup";
import { Heading, type HeadingLevel } from "../../primitives/Heading";
import { Section, type SectionTone } from "../../primitives/Section";
import { hasText, type PatternLink } from "../_internal/types";

export interface TerminalCTAProps {
  heading: string;
  body?: string | undefined;
  /** The single dominant action. Omitting it omits the band: a terminal CTA needs an action. */
  primary: PatternLink | undefined;
  secondary?: PatternLink | undefined;
  /** Surface. Midnight by default: the strategic emphasis close of a page. */
  tone?: SectionTone | undefined;
  headingLevel?: HeadingLevel | undefined;
  /** Id for the heading, used to name the section landmark. */
  id?: string | undefined;
  className?: string | undefined;
}

/**
 * Closing call to action of a page, as the owner comp's closing band: heading, an optional line
 * of context and one primary action in a single row on wide screens, stacked on compact ones.
 */
export function TerminalCTA({
  heading,
  body,
  primary,
  secondary,
  tone = "dark",
  headingLevel = 2,
  id,
  className,
}: TerminalCTAProps) {
  const generatedId = useId();
  const headingId = id ?? generatedId;
  if (!primary || !hasText(heading)) return null;
  return (
    <Section
      tone={tone}
      spacing="compact"
      aria-labelledby={headingId}
      {...(className ? { className } : {})}
    >
      <Container size="wide">
        <div className="grid gap-x-(--space-8) gap-y-(--space-5) lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] lg:items-center">
          <Heading id={headingId} level={headingLevel} size="h2" className="lg:max-w-[16ch]">
            {heading}
          </Heading>
          {hasText(body) ? (
            <p className="m-0 max-w-(--container-prose) text-body text-tone-text text-pretty">
              {body}
            </p>
          ) : (
            <span aria-hidden="true" className="hidden lg:block" />
          )}
          <CTAGroup>
            <Button href={primary.href} size="lg" arrow>
              {primary.label}
            </Button>
            {secondary ? (
              <Button href={secondary.href} variant="text">
                {secondary.label}
              </Button>
            ) : null}
          </CTAGroup>
        </div>
      </Container>
    </Section>
  );
}
