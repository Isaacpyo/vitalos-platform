import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, CTAGroup, SkipLink, Stack, TextLink } from "@vitalos/ui";
import { Frame, OnEveryTone, sample } from "./_frame";

const meta = {
  title: "Primitives/Actions",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Variants: Story = {
  render: () => (
    <Frame>
      <CTAGroup>
        <Button href="#example" variant="primary">
          Example primary (fixture)
        </Button>
        <Button href="#example" variant="secondary">
          Example secondary (fixture)
        </Button>
        <Button href="#example" variant="text">
          Example text (fixture)
        </Button>
      </CTAGroup>
    </Frame>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Frame>
      <CTAGroup>
        {(["sm", "md", "lg"] as const).map((size) => (
          <Button key={size} href="#example" size={size}>
            {`Example ${size} (fixture)`}
          </Button>
        ))}
      </CTAGroup>
    </Frame>
  ),
};

export const OnEverySurface: Story = {
  render: () => (
    <OnEveryTone>
      <CTAGroup>
        <Button href="#example">Example primary (fixture)</Button>
        <Button href="#example" variant="secondary">
          Example secondary (fixture)
        </Button>
        <Button href="#example" variant="text">
          Example text (fixture)
        </Button>
        <TextLink href="#example">Example text link (fixture)</TextLink>
      </CTAGroup>
    </OnEveryTone>
  ),
};

export const ThemeOverride: Story = {
  render: () => (
    <Frame tone="dark">
      <CTAGroup>
        <Button href="#example" theme="dark">
          Example dark theme (fixture)
        </Button>
        <Button href="#example" variant="secondary" theme="dark">
          Example dark secondary (fixture)
        </Button>
      </CTAGroup>
    </Frame>
  ),
};

export const ButtonStates: Story = {
  render: () => (
    <Frame>
      <Stack direction="row" wrap gap={4}>
        <Button>Example default (fixture)</Button>
        <Button disabled>Example disabled (fixture)</Button>
        <Button variant="secondary" disabled>
          Example disabled secondary (fixture)
        </Button>
        <Button variant="text" disabled>
          Example disabled text (fixture)
        </Button>
      </Stack>
    </Frame>
  ),
};

export const FocusVisible: Story = {
  render: () => (
    <Frame>
      <CTAGroup>
        <Button href="#example" id="focus-target">
          Example focused (fixture)
        </Button>
        <TextLink href="#example">Example text link (fixture)</TextLink>
      </CTAGroup>
    </Frame>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>("#focus-target")?.focus();
  },
};

export const TextLinks: Story = {
  render: () => (
    <Frame>
      <Stack gap={3}>
        <TextLink href="#example">Example text link with arrow (fixture)</TextLink>
        <TextLink href="#example" arrow={false}>
          Example text link without arrow (fixture)
        </TextLink>
      </Stack>
    </Frame>
  ),
};

export const LongLabelsAt320: Story = {
  render: () => (
    <Frame width={320}>
      <CTAGroup>
        <Button href="#example" size="lg">
          {sample.longHeading}
        </Button>
        <TextLink href="#example">{sample.longHeading}</TextLink>
      </CTAGroup>
    </Frame>
  ),
};

export const SkipLinkOnFocus: Story = {
  render: () => (
    <Frame>
      <SkipLink href="#skip-target" id="skip-link" />
      <p id="skip-target" tabIndex={-1}>
        Example main content (fixture)
      </p>
    </Frame>
  ),
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>("#skip-link")?.focus();
  },
};
