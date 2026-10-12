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
    ],
  },
});
