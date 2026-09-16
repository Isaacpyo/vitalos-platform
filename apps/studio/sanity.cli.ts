import { defineCliConfig } from "sanity/cli";
export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID ?? "missing",
    dataset: process.env.SANITY_STUDIO_DATASET ?? "development",
  },
});
