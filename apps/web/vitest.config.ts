import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig keeps `jsx: preserve` for Next.js; tests transform JSX themselves.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("../../tooling/vitest/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
