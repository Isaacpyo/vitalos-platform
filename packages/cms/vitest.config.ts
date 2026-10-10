import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "server-only": fileURLToPath(
        new URL("../../tooling/vitest/server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
