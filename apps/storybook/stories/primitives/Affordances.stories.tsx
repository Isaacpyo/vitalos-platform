import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, CircleArrow, IconTile, SlideArrow, TextLink, iconNames } from "@vitalos/ui";
import type { IconName } from "@vitalos/ui";
import { Frame, OnEveryTone, sample } from "./_frame";

/**
 * Affordances ported from the owner comp (ADR-023): the sliding arrow, the arrow disc, icon tiles
 * and the arrowed button and link. Hover or focus the examples to see the arrow slide; under
 * reduced motion it swaps instantly.
 */
const meta = {
  title: "Primitives/Affordances",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const subjectIcons: IconName[] = [
  "compass",
  "code",
  "chip",
  "window",
  "server",
  "workflow",
  "layers",
  "chart",
  "flask",
  "search",
  "shield",
  "building",
  "document",
];

export const ArrowButtons: Story = {
  name: "Button and text link with arrow",
  render: () => (
    <OnEveryTone>
      <div className="flex flex-wrap items-center gap-6">
        <Button href="https://example.invalid/a" arrow>
          {sample.label}
        </Button>
        <Button href="https://example.invalid/b" variant="secondary" arrow>
          {sample.label}
        </Button>
        <TextLink href="https://example.invalid/c">{sample.label}</TextLink>
      </div>
    </OnEveryTone>
  ),
};

export const ArrowDisc: Story = {
  name: "Arrow disc and slide arrow (decorative)",
  render: () => (
    <OnEveryTone>
      <a href="https://example.invalid/card" className="group inline-flex items-center gap-4">
        <span className="text-body font-semibold text-tone-heading">{sample.label}</span>
        <CircleArrow />
        <span className="text-tone-link">
          <SlideArrow size={20} />
        </span>
      </a>
    </OnEveryTone>
  ),
};

export const IconTiles: Story = {
  name: "Icon tiles (decorative, always beside a label)",
  render: () => (
    <OnEveryTone>
      <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 sm:grid-cols-4 lg:grid-cols-7">
        {subjectIcons.map((name) => (
          <li key={name} className="flex items-center gap-3">
            <IconTile name={name} />
            <span className="text-small text-tone-text">{name}</span>
          </li>
        ))}
      </ul>
    </OnEveryTone>
  ),
};

export const IconTileSizes: Story = {
  name: "Icon tile sizes at 320px",
  render: () => (
    <Frame width={320}>
      <div className="flex items-center gap-4">
        <IconTile name="chip" />
        <IconTile name="chip" size="lg" />
        <span className="text-small text-tone-text">{sample.label}</span>
      </div>
    </Frame>
  ),
};

export const AllIconNames: Story = {
  name: "Every icon name",
  render: () => (
    <Frame>
      <p className="text-small text-tone-muted">{iconNames.length} icons</p>
    </Frame>
  ),
};
