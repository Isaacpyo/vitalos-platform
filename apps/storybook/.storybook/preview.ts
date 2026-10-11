import type { Preview } from "@storybook/react-vite";
import { colors } from "@vitalos/design-tokens";
import "./storybook.css";

const preview: Preview = {
  initialGlobals: {
    backgrounds: { value: "light" },
  },
  parameters: {
    // Fail the story (and Storybook build checks) on any axe violation.
    a11y: { test: "error" },
    layout: "padded",
    backgrounds: {
      options: {
        light: { name: "Light", value: colors.white },
        muted: { name: "Muted (cloud)", value: colors.cloud50 },
        midnight: { name: "Midnight", value: colors.midnight950 },
      },
    },
    viewport: {
      options: {
        mobile320: { name: "Mobile 320", styles: { width: "320px", height: "640px" } },
        mobile390: { name: "Mobile 390", styles: { width: "390px", height: "844px" } },
        tablet834: { name: "Tablet 834", styles: { width: "834px", height: "1112px" } },
        desktop1440: { name: "Desktop 1440", styles: { width: "1440px", height: "900px" } },
      },
    },
  },
};

export default preview;
