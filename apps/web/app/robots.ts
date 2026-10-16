import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getSeoContext } from "../src/features/seo/context";
import { robotsPolicy } from "../src/features/seo/robots-policy";
import { isIndexableRequest } from "../src/features/seo/site";

/**
 * Disallows everything unless the deploy env is production AND the request reached the
 * canonical host (ADR-018, ADR-020, docs/seo/DECISIONS.md 9). Reading the host makes this route
 * dynamic, which is cheap: it is a few hundred bytes.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const context = getSeoContext();
  const host = (await headers()).get("host");
  return robotsPolicy({ indexable: isIndexableRequest(context, host), siteUrl: context.siteUrl });
}
