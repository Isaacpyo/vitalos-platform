import { defineConfig } from "sanity";
import { presentationTool } from "sanity/presentation";
import { structureTool } from "sanity/structure";
import { resolveDocumentActions, resolveNewDocumentOptions } from "@vitalos/cms/actions";
import { presentationResolve, previewUrlOption } from "@vitalos/cms/presentation";
import { schemaTypes } from "@vitalos/cms/schemas";
import { deskStructure } from "@vitalos/cms/structure";

/**
 * The Studio must load and build in CI without credentials. A missing project id falls back to a
 * placeholder so `sanity build` and `sanity schema extract` (SANITY_SCHEMA_EXTRACT=1) never crash;
 * the placeholder cannot reach a real project. Real deployments set SANITY_STUDIO_PROJECT_ID.
 */
const configuredProjectId = process.env.SANITY_STUDIO_PROJECT_ID;
const schemaExtract = typeof process !== "undefined" && process.env.SANITY_SCHEMA_EXTRACT === "1";
const projectId =
  configuredProjectId && configuredProjectId.length > 0 ? configuredProjectId : "missing";
if (projectId === "missing" && !schemaExtract) {
  console.warn(
    "SANITY_STUDIO_PROJECT_ID is not set; the Studio uses a placeholder project and cannot load content.",
  );
}

export default defineConfig({
  name: "vitalos",
  title: "Vitalos Editorial Studio",
  projectId,
  dataset: process.env.SANITY_STUDIO_DATASET ?? "development",
  plugins: [
    structureTool({ structure: deskStructure }),
    presentationTool({
      previewUrl: previewUrlOption(process.env.SANITY_STUDIO_PREVIEW_URL),
      resolve: presentationResolve,
    }),
  ],
  schema: {
    types: schemaTypes,
  },
  document: {
    actions: resolveDocumentActions,
    newDocumentOptions: resolveNewDocumentOptions,
  },
});
