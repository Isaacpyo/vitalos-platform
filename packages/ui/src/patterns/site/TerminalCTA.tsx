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

/** Closing call to action of a page: heading, optional line of context, one primary action. */
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
      spacing="large"
      aria-labelledby={headingId}
      {...(className ? { className } : {})}
    >
      <Container>
        <div className="max-w-(--container-prose)">
          <Heading id={headingId} level={headingLevel} size="h2">
            {heading}
          </Heading>
          {hasText(body) ? (
            <p className="mt-(--space-4) text-body-l text-tone-text text-pretty">{body}</p>
          ) : null}
          <CTAGroup className="mt-(--space-6)">
            <Button href={primary.href} size="lg">
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
