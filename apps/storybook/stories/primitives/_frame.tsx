import type { ReactNode } from "react";
import { Section, type SectionTone } from "@vitalos/ui";

/** Obviously artificial sample text. Never real marketing copy. */
export const sample = {
  heading: "Example heading (fixture)",
  longHeading:
    "Example heading (fixture) that is deliberately long so it wraps across several lines and tests balance at narrow widths",
  paragraph:
    "Example paragraph (fixture). This is placeholder text used only to exercise layout, wrapping and contrast. It is not product copy.",
  longWord: "Example-unbroken-token-(fixture)-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  label: "Example label (fixture)",
  source: "Example source (fixture)",
  attribution: "Example Person (fixture), Example Role (fixture)",
} as const;

/**
 * Renders children on a Section of the given tone, optionally inside a fixed-width box that
 * simulates a narrow viewport (320px) so overflow and wrapping problems show up in Storybook.
 */
export function Frame({
  tone = "light",
  width,
  children,
}: {
  tone?: SectionTone;
  width?: number;
  children: ReactNode;
}) {
  return (
    <Section as="div" tone={tone} spacing="compact" className="px-4">
      {width ? <div style={{ width, maxWidth: "100%" }}>{children}</div> : children}
    </Section>
  );
}

/** Light, muted and dark side by side for a component that adapts to surface tone. */
export function OnEveryTone({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <Frame tone="light">{children}</Frame>
      <Frame tone="muted">{children}</Frame>
      <Frame tone="dark">{children}</Frame>
    </div>
  );
}
