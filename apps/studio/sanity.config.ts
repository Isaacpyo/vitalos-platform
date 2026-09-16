import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes, labAsset, trustItem } from "@vitalos/cms/schemas";
const projectId = process.env.SANITY_STUDIO_PROJECT_ID;
if (!projectId) throw new Error("SANITY_STUDIO_PROJECT_ID is required");
export default defineConfig({
  name: "vitalos",
  title: "Vitalos Editorial Studio",
  projectId,
  dataset: process.env.SANITY_STUDIO_DATASET ?? "development",
  plugins: [structureTool()],
  schema: { types: [...schemaTypes, labAsset, trustItem] },
});
