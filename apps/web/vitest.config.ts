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
  test: {
    server: {
      deps: {
        // next-sanity imports extensionless Next.js subpaths (`next/headers`) that Node's ESM
        // resolver rejects; inlining lets Vite resolve them like the Next.js bundler does.
        inline: [/next-sanity/],
      },
    },
  },
});
