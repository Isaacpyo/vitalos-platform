// Public, Sanity-free entry of @vitalos/cms. Safe to import from apps/web (server and client).
// Studio-only code lives behind the ./schemas, ./structure and ./presentation subpaths.
export * from "./content/gates";
export * from "./content/sitemap-rules";
export * from "./content/source";
export * from "./content/types";
export * from "./locked-copy";
export * from "./navigation";
export * from "./routes";

import type { LabMaturity } from "./content/types";

/** @deprecated Use `LabMaturity`. */
export type ContentMaturity = LabMaturity;
export const publishedContentPerspective = "published" as const;
