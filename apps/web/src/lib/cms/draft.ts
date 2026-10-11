import "server-only";
import { draftMode } from "next/headers";
import { unstable_rethrow } from "next/navigation";

/**
 * True when the current request has Draft Mode enabled. Outside a request scope (static
 * generation of `generateStaticParams`, sitemap prerender) it is false. Framework control-flow
 * errors (for example a dynamic-rendering bail-out) are re-thrown, never swallowed.
 */
export async function isDraftModeEnabled(): Promise<boolean> {
  try {
    return (await draftMode()).isEnabled;
  } catch (error) {
    unstable_rethrow(error);
    return false;
  }
}
