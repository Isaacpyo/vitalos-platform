import { industry, offer, practice, solution } from "./commercial";
import {
  homePage,
  job,
  legalPage,
  redirect,
  routePage,
  siteSettings,
  trustItem,
} from "./institutional";
import { caseStudy, insight, labAsset, person } from "./proof";

/** Order matches `documentTypeNames` in constants.ts. */
export const documentTypes = [
  practice,
  solution,
  offer,
  industry,
  caseStudy,
  insight,
  person,
  labAsset,
  trustItem,
  job,
  legalPage,
  routePage,
  homePage,
  siteSettings,
  redirect,
];

export {
  caseStudy,
  homePage,
  industry,
  insight,
  job,
  labAsset,
  legalPage,
  offer,
  person,
  practice,
  redirect,
  routePage,
  siteSettings,
  solution,
  trustItem,
};
