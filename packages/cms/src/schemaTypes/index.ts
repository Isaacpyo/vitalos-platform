/**
 * Sanity schema set for the Vitalos Studio (`@vitalos/cms/schemas`).
 *
 * Studio-only: apps/web must never import this entry (enforced by dependency-cruiser).
 * Model overview and ERD: docs/cms/content-model.md; decision record: ADR-017.
 */
import { documentTypes } from "./documents";
import { objectTypes } from "./objects";

export const schemaTypes = [...objectTypes, ...documentTypes];

export { documentTypes } from "./documents";
export { objectTypes } from "./objects";
export {
  documentTypeNames,
  isSingletonType,
  singletonTypes,
  studioApiVersion,
  type DocumentTypeName,
  type SingletonType,
} from "./constants";
export { documentHref, plannedUrlChange } from "./document-href";
