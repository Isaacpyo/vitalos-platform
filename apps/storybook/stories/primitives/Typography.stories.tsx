import type { Meta, StoryObj } from "@storybook/react-vite";
import { Display, Eyebrow, Heading, Lead, Prose, Small, Stack } from "@vitalos/ui";
import { Frame, OnEveryTone, sample } from "./_frame";

const meta = {
  title: "Primitives/Typography",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const TypeScale: Story = {
  render: () => (
    <Frame>
      <Stack gap={5}>
        <Eyebrow>Example eyebrow (fixture)</Eyebrow>
        <Display size="xl">Example display XL (fixture)</Display>
        <Display size="l" as="h2">
          Example display L (fixture)
        </Display>
        <Heading level={1}>Example H1 (fixture)</Heading>
        <Heading level={2}>Example H2 (fixture)</Heading>
        <Heading level={3}>Example H3 (fixture)</Heading>
        <Heading level={4}>Example H4 (fixture)</Heading>
        <Lead>{sample.paragraph}</Lead>
        <p>{sample.paragraph}</p>
        <Small>Example small text (fixture)</Small>
      </Stack>
    </Frame>
  ),
};

export const SemanticLevelDiffersFromVisualSize: Story = {
  render: () => (
    <Frame>
      <Stack gap={4}>
        <Heading level={2} size="h3">
          Level 2 styled as H3 (fixture)
        </Heading>
        <Heading level={3} size="h1">
          Level 3 styled as H1 (fixture)
        </Heading>
      </Stack>
    </Frame>
  ),
};

export const OnEverySurface: Story = {
  render: () => (
    <OnEveryTone>
      <Stack gap={3}>
        <Eyebrow>Example eyebrow (fixture)</Eyebrow>
        <Heading level={2}>{sample.heading}</Heading>
        <Lead>{sample.paragraph}</Lead>
        <Small>Example small text (fixture)</Small>
      </Stack>
    </OnEveryTone>
  ),
};

export const ProseRichContent: Story = {
  render: () => (
    <Frame>
      <Prose>
        <h2>Example section heading (fixture)</h2>
        <p>
          {sample.paragraph} <a href="#example">Example inline link (fixture)</a> and{" "}
          <strong>example strong text (fixture)</strong>.
        </p>
        <h3>Example subsection heading (fixture)</h3>
        <ul>
          <li>Example list item one (fixture)</li>
          <li>Example list item two (fixture)</li>
        </ul>
        <ol>
          <li>Example ordered item one (fixture)</li>
          <li>Example ordered item two (fixture)</li>
        </ol>
        <blockquote>Example quotation (fixture)</blockquote>
        <p>
          Example code <code>example.fixture()</code> inline.
        </p>
      </Prose>
    </Frame>
  ),
};

export const ProseSerifLongForm: Story = {
  render: () => (
    <Frame>
      <Prose serif>
        <p>{sample.paragraph}</p>
        <p>{sample.paragraph}</p>
      </Prose>
    </Frame>
  ),
};

export const ProseOnDark: Story = {
  render: () => (
    <Frame tone="dark">
      <Prose>
        <h2>Example section heading (fixture)</h2>
        <p>
          {sample.paragraph} <a href="#example">Example inline link (fixture)</a>
        </p>
      </Prose>
    </Frame>
  ),
};

export const LongContentAt320: Story = {
  render: () => (
    <Frame width={320}>
      <Stack gap={4}>
        <Eyebrow>Example eyebrow with several words (fixture)</Eyebrow>
        <Display size="xl">{sample.longHeading}</Display>
        <Lead>{sample.paragraph}</Lead>
        <p>{sample.longWord}</p>
      </Stack>
    </Frame>
  ),
};
