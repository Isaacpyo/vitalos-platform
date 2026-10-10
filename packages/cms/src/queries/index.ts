// GROQ queries (defineQuery) with public-safety projections. Entry: `@vitalos/cms/queries`.
// Safe for the web app (server side): no Studio SDK. `fragments.ts` documents the safety rules.
export * from "./commercial";
export * from "./institutional";
export * from "./params";
export * from "./proof";
export * from "./site";
export * as fragments from "./fragments";
export { createSanityContentSource } from "../content/sanity-source";
export type {
  SanityFetcher,
  SanityFetchOptions,
  SanityContentSourceOptions,
} from "../content/sanity-source";
