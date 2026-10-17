import "server-only";
import { getEnv } from "@vitalos/config";
import { authorHref } from "../content/insights/model";
import { personNode } from "./graph";
import type { JsonLdContext, JsonLdNode } from "./json-ld";

/**
 * The About page's founder `Person` (C11), shown only while the Founder section is (WS2,
 * ADR-045, `ABOUT_FOUNDER_ENABLED`). The Person is the Insights author: its `@id` is the author
 * page's (`/insights/authors/{slug}#person`), so the About page and the author page describe the
 * same person. Every value comes from the published author profile; nothing is added.
 */
export function aboutFounderEnabled(): boolean {
  return getEnv().site.aboutFounderEnabled;
}

export interface FounderProfile {
  name: string;
  slug: string;
  /** The title the section shows, for example "Founder". */
  roleTitle?: string | undefined;
  linkedinUrl?: string | undefined;
}

/** The founder's Person node, or null while the Founder section is off. */
export function founderPersonNode(
  founder: FounderProfile | null | undefined,
  ctx: JsonLdContext,
): JsonLdNode | null {
  if (!founder || !aboutFounderEnabled()) return null;
  return personNode(
    {
      name: founder.name,
      path: authorHref(founder.slug),
      jobTitle: founder.roleTitle,
      sameAs: founder.linkedinUrl ? [founder.linkedinUrl] : [],
    },
    ctx,
  );
}
