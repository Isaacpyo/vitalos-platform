import "server-only";
import type { Metadata } from "next";
import { careersTitle } from "../../features/content/careers/model";
import { pageMetadata } from "../institutional/metadata";

/** Metadata for the Careers pages: "{title} | Careers at Vitalos", canonical, OG, robots. */
export function careersMetadata(input: {
  path: string;
  title: string;
  description?: string | undefined;
  noindex?: boolean | undefined;
  follow?: boolean | undefined;
}): Promise<Metadata> {
  return pageMetadata({
    path: input.path,
    title: careersTitle(input.title),
    description: input.description,
    absoluteTitle: true,
    noindex: input.noindex,
    follow: input.follow,
  });
}
