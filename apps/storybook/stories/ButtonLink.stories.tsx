import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonLink } from "@vitalos/ui";

const meta = {
  component: ButtonLink,
  args: { children: "Talk to Vitalos", href: "#" },
} satisfies Meta<typeof ButtonLink>;

export default meta;
export const Default: StoryObj<typeof meta> = {};
