import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  // Inline (empty) PostCSS config: the launcher and panel tests import CSS, and Vite must not
  // search parent folders for a PostCSS config of another project.
  css: { postcss: { plugins: [] } },
  test: { environment: "jsdom" },
});
