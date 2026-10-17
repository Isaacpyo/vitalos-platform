import { FeatureGrid } from "@vitalos/ui";
import type { SectionTone } from "@vitalos/ui";
import { proofApproachHeading } from "../../lib/view-mapping/proof-approach";
import type { ProofApproachItem } from "../../lib/view-mapping/proof-approach";
import { Band } from "./bands";

/**
 * "How we prove it" (finding B3): the quality gates, Labs with its maturity labels, the Trust
 * Centre and Insights as linked icon cards, on the homepage below the practices and on About.
 * Nothing renders without items; every word comes from `proofApproachItems`.
 */
export function ProofApproachBand({
  items,
  tone,
}: Readonly<{ items: readonly ProofApproachItem[]; tone: SectionTone }>) {
  if (items.length === 0) return null;
  return (
    <Band tone={tone} heading={proofApproachHeading}>
      <FeatureGrid
        columns={items.length === 4 ? 4 : items.length === 2 ? 2 : 3}
        items={items.map((item) => ({
          title: item.title,
          text: item.text,
          href: item.href,
          icon: item.icon,
          ...(item.meta ? { meta: item.meta } : {}),
        }))}
      />
    </Band>
  );
}
