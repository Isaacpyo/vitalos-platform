import type { MetadataRoute } from "next";
import { getSeoContext } from "../src/features/seo/context";
import { robotsPolicy } from "../src/features/seo/robots-policy";

/** Disallows everything unless the deploy env is production (ADR-018, ADR-020). */
export default function robots(): MetadataRoute.Robots {
  return robotsPolicy(getSeoContext());
}
