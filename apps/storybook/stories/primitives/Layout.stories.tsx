import type { Meta, StoryObj } from "@storybook/react-vite";
import { Container, Heading, Lead, Rule, Section, Stack, VisuallyHidden } from "@vitalos/ui";
import { Frame, sample } from "./_frame";

const meta = {
  title: "Primitives/Layout",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const SectionTones: Story = {
  render: () => (
    <>
      {(["light", "muted", "dark"] as const).map((tone) => (
        <Section key={tone} tone={tone} aria-label={`${tone} section (fixture)`}>
          <Container>
            <Heading level={2}>{`Example ${tone} section (fixture)`}</Heading>
            <Lead className="mt-4">{sample.paragraph}</Lead>
          </Container>
        </Section>
      ))}
    </>
  ),
};

export const SectionSpacingScale: Story = {
  render: () => (
    <>
      {(["compact", "default", "large"] as const).map((spacing) => (
        <Section
          key={spacing}
          tone="muted"
          spacing={spacing}
          className="border-y border-tone-border"
        >
          <Container>
            <Heading level={2} size="h3">{`Example ${spacing} spacing (fixture)`}</Heading>
          </Container>
        </Section>
      ))}
    </>
  ),
};

export const ContainerSizes: Story = {
  render: () => (
    <Section as="div">
      {(["wide", "content", "prose"] as const).map((size) => (
        <Container key={size} size={size} className="mb-4 border border-tone-border py-2">
          {`Example container: ${size} (fixture)`}
        </Container>
      ))}
    </Section>
  ),
};

export const StackAndRule: Story = {
  render: () => (
    <Frame>
      <Stack gap={5}>
        <Heading level={2}>{sample.heading}</Heading>
        <Rule />
        <Stack as="ul" gap={2}>
          <li>Example list item one (fixture)</li>
          <li>Example list item two (fixture)</li>
        </Stack>
        <Rule strong />
        <Stack direction="row" wrap gap={3} align="center">
          <span>Example inline one (fixture)</span>
          <span>Example inline two (fixture)</span>
          <span>Example inline three (fixture)</span>
        </Stack>
      </Stack>
    </Frame>
  ),
};

export const DarkRule: Story = {
  render: () => (
    <Frame tone="dark">
      <Rule />
    </Frame>
  ),
};

export const NarrowContainer320: Story = {
  render: () => (
    <Frame width={320}>
      <Stack gap={4}>
        <Heading level={2}>{sample.longHeading}</Heading>
        <p>{sample.longWord}</p>
      </Stack>
    </Frame>
  ),
};

export const VisuallyHiddenText: Story = {
  render: () => (
    <Frame>
      <p>
        Visible text (fixture){" "}
        <VisuallyHidden>read only by assistive technology (fixture)</VisuallyHidden>
      </p>
    </Frame>
  ),
};
