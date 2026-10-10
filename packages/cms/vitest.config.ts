import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "server-only",
        replacement: fileURLToPath(
          new URL("../../tooling/vitest/server-only-stub.ts", import.meta.url),
        ),
      },
      // The Studio SDK is slow to load under Node; schema tests need only its identity helpers.
      {
        find: /^sanity(\/.*)?$/,
        replacement: fileURLToPath(
          new URL("./src/schemaTypes/testing/sanity-stub.ts", import.meta.url),
        ),
      },
    ],
  },
});
