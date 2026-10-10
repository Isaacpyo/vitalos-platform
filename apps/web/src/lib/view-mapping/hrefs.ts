import { hrefForDocument, routes } from "@vitalos/cms";
import type {
  ContactIntent,
  CtaView,
  DocKind,
  DocumentRef,
  LabType,
  SummaryFor,
  TrustTopic,
} from "@vitalos/cms";
import type { PatternLink } from "@vitalos/ui";
import { isSafeLink } from "../cms/rich-text";

/**
 * The document reference for a summary, or null when the summary cannot be resolved to a public
 * route (a lab asset without a lab type, a trust topic without a topic). Callers drop those:
 * a link that cannot be built is never rendered.
 */
export function documentRefForSummary<K extends DocKind>(
  kind: K,
  summary: SummaryFor<K>,
): DocumentRef | null {
  const s = summary as unknown as { slug?: string; labType?: LabType; topic?: TrustTopic };
  switch (kind) {
    case "labAsset":
      return s.slug && s.labType ? { kind: "labAsset", labType: s.labType, slug: s.slug } : null;
    case "trustItem":
      return s.topic ? { kind: "trustItem", slug: s.topic } : null;
    case "legalPage":
      return s.slug ? ({ kind: "legalPage", slug: s.slug } as DocumentRef) : null;
    default:
      return s.slug ? ({ kind, slug: s.slug } as DocumentRef) : null;
  }
}

/** Public URL of a summary (via routes.ts, the single source of URLs), or null. */
export function hrefForSummary<K extends DocKind>(kind: K, summary: SummaryFor<K>): string | null {
  const ref = documentRefForSummary(kind, summary);
  return ref ? hrefForDocument(ref) : null;
}

/**
 * A CMS call to action as a pattern link. Only same-site paths and https URLs are kept
 * (`CtaView.href` is already resolved by the mapper; this is the second check at the boundary).
 */
export function ctaToLink(cta: CtaView | undefined): PatternLink | undefined {
  if (!cta || cta.label.trim() === "" || !isSafeLink(cta.href)) return undefined;
  return { label: cta.label, href: cta.href };
}

/** Contact URL with the enquiry intent and, for an offer, the offer slug the form pre-selects. */
export function contactHref(intent?: ContactIntent, offerSlug?: string): string {
  const base = routes.contact(intent);
  return offerSlug ? `${base}&offer=${encodeURIComponent(offerSlug)}` : base;
}
