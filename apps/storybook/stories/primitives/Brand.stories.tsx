import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icon, iconNames, Stack, Wordmark } from "@vitalos/ui";
import { Frame, OnEveryTone } from "./_frame";

const meta = {
  title: "Primitives/Brand",
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Interim: Figma logo exports are not yet available, so the text fallback is the default. */
export const WordmarkTextFallback: Story = {
  render: () => (
    <OnEveryTone>
      <Stack gap={4}>
        <Wordmark />
        <Wordmark href="#home" />
      </Stack>
    </OnEveryTone>
  ),
};

/** The typed logo slot, using an obviously artificial inline asset (not the real logo). */
export const WordmarkLogoSlot: Story = {
  render: () => (
    <Frame>
      <Wordmark
        logo={{
          src: "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='24'%3E%3Crect width='120' height='24' fill='none' stroke='black'/%3E%3C/svg%3E",
          width: 120,
          height: 24,
          alt: "Example logo slot (fixture)",
        }}
      />
    </Frame>
  ),
};

export const Icons: Story = {
  render: () => (
    <OnEveryTone>
      <ul className="m-0 flex list-none flex-wrap gap-6 p-0">
        {iconNames.map((name) => (
          <li key={name} className="flex flex-col items-center gap-2 text-small">
            <Icon name={name} size={24} />
            <span>{name}</span>
          </li>
        ))}
      </ul>
    </OnEveryTone>
  ),
};
