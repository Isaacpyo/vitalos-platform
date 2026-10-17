import { contactIntents, hrefForDocument, routes } from "@vitalos/cms";
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
export function ctaToLink(
  cta: CtaView | undefined,
  options: { offerSlug?: string | undefined } = {},
): PatternLink | undefined {
  if (!cta || cta.label.trim() === "" || !isSafeLink(cta.href)) return undefined;
  // A call to action to the contact page opens the form on its topic (finding B13, 17 Oct 2026):
  // the content's intent was dropped before, so every "Discuss ..." link opened a blank form. On an
  // offer page the form opens on that offer (`?intent=offer&offer={slug}`).
  if (cta.href === routes.contact()) {
    if (options.offerSlug) return { label: cta.label, href: contactHref("offer", options.offerSlug) };
    if (isContactIntent(cta.intent)) return { label: cta.label, href: contactHref(cta.intent) };
  }
  return { label: cta.label, href: cta.href };
}

const isContactIntent = (value: string | undefined): value is ContactIntent =>
  value !== undefined && (contactIntents as readonly string[]).includes(value);

/** Contact URL with the enquiry intent and, for an offer, the offer slug the form pre-selects. */
export function contactHref(intent?: ContactIntent, offerSlug?: string): string {
  const base = routes.contact(intent);
  return offerSlug ? `${base}&offer=${encodeURIComponent(offerSlug)}` : base;
}
