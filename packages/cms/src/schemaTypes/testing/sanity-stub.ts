/**
 * Vitest stand-in for `sanity`, `sanity/structure` and `sanity/presentation`.
 *
 * Importing the real Studio SDK takes minutes under Node and the schema definitions only use its
 * identity helpers. Hooks (`useClient`, `useValidationStatus`) are intentionally absent: tests cover
 * the pure logic behind the actions and never render them.
 */
export const defineType = <T>(definition: T): T => definition;
export const defineField = <T>(definition: T): T => definition;
export const defineArrayMember = <T>(definition: T): T => definition;
export const defineLocations = <T>(definition: T): T => definition;
export const defineDocuments = <T>(definitions: T): T => definitions;
