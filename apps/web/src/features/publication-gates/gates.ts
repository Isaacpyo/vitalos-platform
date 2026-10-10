import { notFound } from "next/navigation";
import { isDetailIndexable, shouldServeIndex } from "@vitalos/cms";
import type { GateKey, PublicationGates } from "@vitalos/cms";
import { isDraftModeEnabled } from "../../lib/cms/draft";
import { getContentSource } from "../../lib/cms/get-content-source";

/**
 * Page-level helpers for publication gates (ADR-022). Pages call these instead of repeating
 * the rules:
 *
 *   // index page (`/work`)
 *   await requireGateOpen("work");                       // 404 below threshold
 *   // detail page (`/work/[slug]`)
 *   const noindex = !(await isDetailIndexableNow("work"));
 *   return buildMetadata({ ..., noindex });
 *
 * In Draft Mode editors may open a closed section so they can preview it before it is public;
 * visitors never can.
 */

/** Pure decision: should an index route of a gated section be served? */
export function indexIsServable(
  gate: GateKey | undefined,
  gates: PublicationGates,
  options: { draft?: boolean } = {},
): boolean {
  return options.draft === true || shouldServeIndex(gate, gates);
}

/** Current publication gates for this request (draft-aware like every other read). */
export async function getGates(): Promise<PublicationGates> {
  return (await getContentSource()).getPublicationGates();
}

/**
 * Calls `notFound()` when the section's gate is closed (outside Draft Mode). Returns the gates
 * so the caller can reuse them (for example to build navigation) without a second read.
 */
export async function requireGateOpen(gate: GateKey | undefined): Promise<PublicationGates> {
  const [gates, draft] = await Promise.all([getGates(), isDraftModeEnabled()]);
  if (!indexIsServable(gate, gates, { draft })) notFound();
  return gates;
}

/** False for a detail page of a closed section: it stays reachable but must be noindex. */
export async function isDetailIndexableNow(gate: GateKey | undefined): Promise<boolean> {
  return isDetailIndexable(gate, await getGates());
}
