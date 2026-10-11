import type { RichText } from "../../content/types";
import type { PersonSlug } from "./people";

/** One placeholder article as written; `insights.ts` turns it into a view with provenance. */
export interface InsightDraftBody {
  slug: string;
  title: string;
  summary: string;
  /** At most 60 characters. */
  seoTitle: string;
  /** At most 160 characters. */
  seoDescription: string;
  /** A value from the schema's insight format list (`insightFormatList`). */
  format: string;
  /** One to three values from the schema's topic list (`insightTopicList`). */
  topics: readonly string[];
  author: PersonSlug;
  publishedAt: string;
  /** Slugs of other placeholder insights. */
  related: readonly string[];
  /** Strategy sections the article was drafted from: `[stage, section heading]`. */
  sources: readonly (readonly [number, string])[];
  body: RichText;
}
