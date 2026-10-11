import { defineCliConfig } from "sanity/cli";

// Typegen only. Schema extraction runs from apps/studio (it needs the Studio config) and writes
// src/generated/schema.json; `pnpm check:cms-types` runs both and fails on drift.
export default defineCliConfig({
  typegen: {
    path: "./src/queries/**/*.ts",
    schema: "./src/generated/schema.json",
    generates: "./src/generated/sanity.types.ts",
  },
});
