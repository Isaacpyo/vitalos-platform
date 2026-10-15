// Public entry of @vitalos/cms. Safe to import from apps/web (server and client).
export * from "./content/gates";
export * from "./content/podcast";
export * from "./content/sitemap-rules";
export * from "./content/source";
export * from "./content/types";
export * from "./locked-copy";
export * from "./navigation";
export * from "./routes";

import type { LabMaturity } from "./content/types";

/** @deprecated Use `LabMaturity`. */
export type ContentMaturity = LabMaturity;
