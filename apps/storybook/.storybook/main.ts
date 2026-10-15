import tailwindcss from "@tailwindcss/vite";
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  // The widget loads its symbol by URL; serve the same brand file the web app does.
  staticDirs: [{ from: "../../web/public/brand", to: "/brand" }],
  framework: { name: "@storybook/react-vite", options: {} },
  // Tailwind v4 through its Vite plugin; the entry stylesheet is .storybook/storybook.css.
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    plugins: [...(viteConfig.plugins ?? []), tailwindcss()],
  }),
};
export default config;
