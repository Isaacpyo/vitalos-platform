import { notFound } from "next/navigation";
import { isDetailIndexable, shouldServeIndex } from "@vitalos/cms";
import type { GateKey, PublicationGates } from "@vitalos/cms";
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
 */

/** Pure decision: should an index route of a gated section be served? */
export function indexIsServable(gate: GateKey | undefined, gates: PublicationGates): boolean {
  return shouldServeIndex(gate, gates);
}

/** Current publication gates for this request . */
export async function getGates(): Promise<PublicationGates> {
  return (await getContentSource()).getPublicationGates();
}

/**
 * Calls `notFound()` when the section's gate is closed. Returns the gates
 * so the caller can reuse them (for example to build navigation) without a second read.
 */
export async function requireGateOpen(gate: GateKey | undefined): Promise<PublicationGates> {
  const gates = await getGates();
  if (!indexIsServable(gate, gates)) notFound();
  return gates;
}

/** False for a detail page of a closed section: it stays reachable but must be noindex. */
export async function isDetailIndexableNow(gate: GateKey | undefined): Promise<boolean> {
  return isDetailIndexable(gate, await getGates());
}
