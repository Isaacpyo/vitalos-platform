import { useId } from "react";
import { Reveal } from "../../motion/Reveal";
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
  /**
   * `band` (default): the single-row closing band. `feature`: a large rounded card in a Vitalos
   * Blue to Midnight gradient on a light band, with display-size heading and decorative rings.
   */
  variant?: "band" | "feature" | undefined;
  /** Id for the heading, used to name the section landmark. */
  id?: string | undefined;
  className?: string | undefined;
}

/**
 * Closing call to action of a page, as the owner comp's closing band: heading, an optional line
 * of context and one primary action in a single row on wide screens, stacked on compact ones.
 * The band rises in once when it first scrolls into view (Reveal: static without JavaScript,
 * under reduced motion and when it is already on screen).
 */
export function TerminalCTA({
  heading,
  body,
  primary,
  secondary,
  tone = "dark",
  headingLevel = 2,
  variant = "band",
  id,
  className,
}: TerminalCTAProps) {
  const generatedId = useId();
  const headingId = id ?? generatedId;
  if (!primary || !hasText(heading)) return null;
  if (variant === "feature") {
    return (
      <Section tone="light" aria-labelledby={headingId} {...(className ? { className } : {})}>
        <Container size="wide">
          <Reveal>
            <div
              data-tone="dark"
              className="relative isolate overflow-hidden rounded-[2rem] bg-linear-135 from-blue-600 via-blue-700 to-midnight-950 px-(--space-5) py-(--space-9) text-tone-text sm:px-(--space-8) lg:px-(--space-9) lg:py-(--space-10)"
            >
              <span
                aria-hidden="true"
                className="absolute -right-24 -bottom-32 -z-10 size-[34rem] rounded-full bg-aqua-600/40 blur-3xl"
              />
              <svg
                aria-hidden="true"
                viewBox="0 0 400 400"
                className="absolute top-1/2 -right-28 -z-10 hidden size-[36rem] -translate-y-1/2 text-white md:block"
                fill="none"
              >
                {[60, 105, 150, 195].map((r, index) => (
                  <circle
                    key={r}
                    cx="200"
                    cy="200"
                    r={r}
                    stroke="currentColor"
                    strokeOpacity={0.16 - index * 0.03}
                    strokeWidth="1"
                  />
                ))}
                <circle cx="200" cy="5" r="5" fill="currentColor" fillOpacity="0.6" />
                <circle cx="350" cy="200" r="4" fill="currentColor" fillOpacity="0.45" />
                <circle cx="95" cy="200" r="3.5" fill="currentColor" fillOpacity="0.5" />
              </svg>
              <div className="max-w-2xl">
                <Heading
                  id={headingId}
                  level={headingLevel}
                  size="h1"
                  className="text-balance text-tone-heading"
                >
                  {heading}
                </Heading>
                {hasText(body) ? (
                  <p className="m-0 mt-(--space-5) max-w-(--container-prose) text-body-l text-pretty text-tone-text">
                    {body}
                  </p>
                ) : null}
                <CTAGroup className="mt-(--space-7)">
                  <Button href={primary.href} size="lg" arrow>
                    {primary.label}
                  </Button>
                  {secondary ? (
                    <Button href={secondary.href} variant="secondary" size="lg" arrow>
                      {secondary.label}
                    </Button>
                  ) : null}
                </CTAGroup>
              </div>
            </div>
          </Reveal>
        </Container>
      </Section>
    );
  }
  return (
    <Section
      tone={tone}
      spacing="compact"
      aria-labelledby={headingId}
      {...(className ? { className } : {})}
    >
      <Container size="wide">
        <Reveal className="grid gap-x-(--space-8) gap-y-(--space-5) lg:grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto] lg:items-center">
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
        </Reveal>
      </Container>
    </Section>
  );
}
